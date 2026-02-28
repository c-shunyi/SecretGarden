const crypto = require("node:crypto");
const express = require("express");
const { execute, query, queryOne, withTransaction } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/async-handler");
const { AppError } = require("../utils/app-error");

const router = express.Router();

function parsePlanId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "INVALID_PLAN_ID", "Invalid plan id");
  }
  return id;
}

function normalizePlanName(value) {
  const name = String(value || "").trim();
  if (!name || name.length > 60) {
    throw new AppError(400, "INVALID_PLAN_NAME", "Plan name length must be 1-60");
  }
  return name;
}

function normalizePlanDescription(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const description = String(value).trim();
  if (!description) return null;
  if (description.length > 255) {
    throw new AppError(400, "INVALID_PLAN_DESCRIPTION", "Description length must be <= 255");
  }
  return description;
}

function normalizeInviteCode(value) {
  const inviteCode = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(inviteCode)) {
    throw new AppError(400, "INVALID_INVITE_CODE", "Invite code must be 6-20 uppercase letters/digits");
  }
  return inviteCode;
}

function generateInviteCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function normalizePostContent(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const content = String(value).trim();
  if (!content) return null;
  if (content.length > 2000) {
    throw new AppError(400, "INVALID_CONTENT", "Content length must be <= 2000");
  }
  return content;
}

function normalizeImageFileIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new AppError(400, "INVALID_IMAGE_FILE_IDS", "imageFileIds must be array");
  }
  const unique = new Set();
  value.forEach((item) => {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, "INVALID_IMAGE_FILE_IDS", "imageFileIds must be positive integer array");
    }
    unique.add(id);
  });

  const ids = Array.from(unique);
  if (ids.length > 9) {
    throw new AppError(400, "TOO_MANY_IMAGES", "At most 9 images");
  }
  return ids;
}

async function ensurePlanMember(planId, userId) {
  const row = await queryOne(
    `
      SELECT p.id, p.name, p.description, p.invite_code, p.creator_id, p.created_at, p.updated_at, m.role AS my_role
      FROM checkin_plans p
      JOIN checkin_plan_members m ON m.plan_id = p.id
      WHERE p.id = ? AND m.user_id = ?
    `,
    [planId, userId]
  );
  if (!row) {
    throw new AppError(404, "CHECKIN_PLAN_NOT_FOUND", "Checkin plan not found");
  }
  return row;
}

function toPlanView(row, extras = {}) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    inviteCode: row.invite_code,
    creatorId: Number(row.creator_id),
    myRole: row.my_role || null,
    memberCount:
      extras.memberCount === undefined || extras.memberCount === null
        ? undefined
        : Number(extras.memberCount),
    latestPostAt: extras.latestPostAt || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPostView(row) {
  return {
    id: Number(row.id),
    planId: Number(row.plan_id),
    user: {
      id: Number(row.user_id),
      account: row.account,
      nickname: row.nickname,
      avatarFileId: row.avatar_file_id === null ? null : Number(row.avatar_file_id),
    },
    content: row.content,
    createdAt: row.created_at,
    images: [],
  };
}

async function assertFileOwnership(fileIds, userId) {
  if (!fileIds.length) return;
  const placeholders = fileIds.map(() => "?").join(", ");
  const rows = await query(
    `SELECT id FROM files WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...fileIds]
  );
  if (rows.length !== fileIds.length) {
    throw new AppError(400, "INVALID_IMAGE_FILE_IDS", "Some image files do not belong to current user");
  }
}

router.post(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const name = normalizePlanName(req.body.name);
    const description = normalizePlanDescription(req.body.description);
    const creatorId = Number(req.user.id);

    let createdPlanId = 0;
    let createdPlanRow = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const inviteCode = generateInviteCode();
      try {
        await withTransaction(async (connection) => {
          const [planResult] = await connection.execute(
            `
              INSERT INTO checkin_plans (name, description, invite_code, creator_id)
              VALUES (?, ?, ?, ?)
            `,
            [name, description, inviteCode, creatorId]
          );

          createdPlanId = planResult.insertId;
          await connection.execute(
            `
              INSERT INTO checkin_plan_members (plan_id, user_id, role)
              VALUES (?, ?, 'OWNER')
            `,
            [createdPlanId, creatorId]
          );
        });

        createdPlanRow = await ensurePlanMember(createdPlanId, creatorId);
        break;
      } catch (error) {
        if (error && error.code === "ER_DUP_ENTRY") {
          continue;
        }
        throw error;
      }
    }

    if (!createdPlanRow) {
      throw new AppError(500, "INVITE_CODE_GENERATION_FAILED", "Failed to generate unique invite code");
    }

    res.status(201).json({
      plan: toPlanView(createdPlanRow, { memberCount: 1, latestPostAt: null }),
    });
  })
);

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `
        SELECT
          p.id,
          p.name,
          p.description,
          p.invite_code,
          p.creator_id,
          p.created_at,
          p.updated_at,
          m.role AS my_role,
          COUNT(DISTINCT m2.user_id) AS member_count,
          MAX(cp.created_at) AS latest_post_at
        FROM checkin_plans p
        JOIN checkin_plan_members m ON m.plan_id = p.id AND m.user_id = ?
        LEFT JOIN checkin_plan_members m2 ON m2.plan_id = p.id
        LEFT JOIN checkin_posts cp ON cp.plan_id = p.id
        GROUP BY
          p.id, p.name, p.description, p.invite_code, p.creator_id, p.created_at, p.updated_at, m.role
        ORDER BY COALESCE(MAX(cp.created_at), p.created_at) DESC, p.id DESC
      `,
      [req.user.id]
    );

    res.json({
      plans: rows.map((row) =>
        toPlanView(row, {
          memberCount: row.member_count,
          latestPostAt: row.latest_post_at,
        })
      ),
    });
  })
);

router.get(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const planId = parsePlanId(req.params.id);
    const planRow = await ensurePlanMember(planId, req.user.id);

    const members = await query(
      `
        SELECT u.id, u.account, u.nickname, u.avatar_file_id, m.role, m.joined_at
        FROM checkin_plan_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.plan_id = ?
        ORDER BY m.joined_at ASC, m.id ASC
      `,
      [planId]
    );

    res.json({
      plan: {
        ...toPlanView(planRow, { memberCount: members.length }),
        members: members.map((member) => ({
          id: Number(member.id),
          account: member.account,
          nickname: member.nickname,
          avatarFileId: member.avatar_file_id === null ? null : Number(member.avatar_file_id),
          role: member.role,
          joinedAt: member.joined_at,
        })),
      },
    });
  })
);

router.post(
  "/join",
  authRequired,
  asyncHandler(async (req, res) => {
    const inviteCode = normalizeInviteCode(req.body.inviteCode);
    const plan = await queryOne(
      `
        SELECT id
        FROM checkin_plans
        WHERE invite_code = ?
      `,
      [inviteCode]
    );

    if (!plan) {
      throw new AppError(404, "INVITE_CODE_NOT_FOUND", "Invite code not found");
    }

    await execute(
      `
        INSERT IGNORE INTO checkin_plan_members (plan_id, user_id, role)
        VALUES (?, ?, 'MEMBER')
      `,
      [plan.id, req.user.id]
    );

    const planRow = await ensurePlanMember(plan.id, req.user.id);
    const memberCountRow = await queryOne(
      "SELECT COUNT(*) AS count FROM checkin_plan_members WHERE plan_id = ?",
      [plan.id]
    );

    res.json({
      plan: toPlanView(planRow, {
        memberCount: memberCountRow.count,
      }),
    });
  })
);

router.post(
  "/:id/invite",
  authRequired,
  asyncHandler(async (req, res) => {
    const planId = parsePlanId(req.params.id);
    const planRow = await ensurePlanMember(planId, req.user.id);
    if (planRow.my_role !== "OWNER") {
      throw new AppError(403, "FORBIDDEN", "Only owner can regenerate invite code");
    }

    let nextCode = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateInviteCode();
      try {
        await execute("UPDATE checkin_plans SET invite_code = ? WHERE id = ?", [candidate, planId]);
        nextCode = candidate;
        break;
      } catch (error) {
        if (error && error.code === "ER_DUP_ENTRY") {
          continue;
        }
        throw error;
      }
    }

    if (!nextCode) {
      throw new AppError(500, "INVITE_CODE_GENERATION_FAILED", "Failed to generate unique invite code");
    }

    res.json({
      inviteCode: nextCode,
    });
  })
);

router.get(
  "/:id/feed",
  authRequired,
  asyncHandler(async (req, res) => {
    const planId = parsePlanId(req.params.id);
    await ensurePlanMember(planId, req.user.id);

    const rawLimit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
      throw new AppError(400, "INVALID_LIMIT", "limit must be integer between 1 and 50");
    }
    const safeLimit = rawLimit;

    let beforeId = null;
    if (req.query.beforeId !== undefined) {
      beforeId = Number(req.query.beforeId);
      if (!Number.isInteger(beforeId) || beforeId <= 0) {
        throw new AppError(400, "INVALID_BEFORE_ID", "beforeId must be positive integer");
      }
    }

    const params = [planId];
    let whereSuffix = "";
    if (beforeId !== null) {
      whereSuffix = "AND cp.id < ?";
      params.push(beforeId);
    }
    const sql = `
        SELECT
          cp.id,
          cp.plan_id,
          cp.user_id,
          cp.content,
          cp.created_at,
          u.account,
          u.nickname,
          u.avatar_file_id
        FROM checkin_posts cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.plan_id = ?
        ${whereSuffix}
        ORDER BY cp.id DESC
        LIMIT ${safeLimit}
      `;

    const rows = await query(sql, params);

    const posts = rows.map(toPostView);
    if (posts.length) {
      const postIds = posts.map((post) => post.id);
      const placeholders = postIds.map(() => "?").join(", ");
      const imageRows = await query(
        `
          SELECT
            cpi.post_id,
            cpi.sort_order,
            f.id AS file_id,
            f.original_name,
            f.mime_type,
            f.size_bytes
          FROM checkin_post_images cpi
          JOIN files f ON f.id = cpi.file_id
          WHERE cpi.post_id IN (${placeholders})
          ORDER BY cpi.post_id DESC, cpi.sort_order ASC, cpi.id ASC
        `,
        postIds
      );

      const imageMap = new Map();
      imageRows.forEach((row) => {
        const list = imageMap.get(Number(row.post_id)) || [];
        list.push({
          id: Number(row.file_id),
          originalName: row.original_name,
          mimeType: row.mime_type,
          sizeBytes: Number(row.size_bytes),
          contentUrl: `/api/v1/files/${row.file_id}/content`,
        });
        imageMap.set(Number(row.post_id), list);
      });

      posts.forEach((post) => {
        post.images = imageMap.get(post.id) || [];
      });
    }

    res.json({
      posts,
      hasMore: posts.length === safeLimit,
    });
  })
);

router.post(
  "/:id/posts",
  authRequired,
  asyncHandler(async (req, res) => {
    const planId = parsePlanId(req.params.id);
    await ensurePlanMember(planId, req.user.id);

    const content = normalizePostContent(req.body.content);
    const imageFileIds = normalizeImageFileIds(req.body.imageFileIds);
    if (!content && !imageFileIds.length) {
      throw new AppError(400, "EMPTY_CHECKIN_POST", "Please provide content or at least one image");
    }

    await assertFileOwnership(imageFileIds, req.user.id);

    const postId = await withTransaction(async (connection) => {
      const [postResult] = await connection.execute(
        `
          INSERT INTO checkin_posts (plan_id, user_id, content)
          VALUES (?, ?, ?)
        `,
        [planId, req.user.id, content]
      );

      const createdPostId = postResult.insertId;
      if (imageFileIds.length) {
        const valuesSql = imageFileIds.map(() => "(?, ?, ?)").join(", ");
        const values = [];
        imageFileIds.forEach((fileId, index) => {
          values.push(createdPostId, fileId, index);
        });
        await connection.execute(
          `
            INSERT INTO checkin_post_images (post_id, file_id, sort_order)
            VALUES ${valuesSql}
          `,
          values
        );
      }

      return createdPostId;
    });

    const postRow = await queryOne(
      `
        SELECT
          cp.id,
          cp.plan_id,
          cp.user_id,
          cp.content,
          cp.created_at,
          u.account,
          u.nickname,
          u.avatar_file_id
        FROM checkin_posts cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.id = ? AND cp.plan_id = ?
      `,
      [postId, planId]
    );
    const post = toPostView(postRow);

    if (imageFileIds.length) {
      const placeholders = imageFileIds.map(() => "?").join(", ");
      const imageRows = await query(
        `
          SELECT id, original_name, mime_type, size_bytes
          FROM files
          WHERE id IN (${placeholders})
          ORDER BY FIELD(id, ${placeholders})
        `,
        [...imageFileIds, ...imageFileIds]
      );
      post.images = imageRows.map((row) => ({
        id: Number(row.id),
        originalName: row.original_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        contentUrl: `/api/v1/files/${row.id}/content`,
      }));
    }

    res.status(201).json({
      post,
    });
  })
);

module.exports = router;
