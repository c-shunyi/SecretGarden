const express = require("express");
const { execute, query, queryOne } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/async-handler");
const { AppError } = require("../utils/app-error");

const router = express.Router();

const allowedBillTypes = new Set(["EXPENSE", "INCOME"]);

function normalizeBillType(value) {
  const billType = String(value || "").trim().toUpperCase();
  if (!allowedBillTypes.has(billType)) {
    throw new AppError(400, "INVALID_BILL_TYPE", "billType 仅支持 EXPENSE 或 INCOME");
  }
  return billType;
}

function normalizeCategory(value) {
  const category = String(value || "").trim();
  if (!category || category.length > 32) {
    throw new AppError(400, "INVALID_CATEGORY", "分类不能为空且长度不能超过 32");
  }
  return category;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, "INVALID_AMOUNT", "金额必须大于 0");
  }
  return Number(amount.toFixed(2));
}

function normalizeNote(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const note = String(value).trim();
  if (note.length > 255) {
    throw new AppError(400, "INVALID_NOTE", "备注不能超过 255 字");
  }
  return note || null;
}

function normalizeBillDate(value) {
  const billDate = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billDate)) {
    throw new AppError(400, "INVALID_BILL_DATE", "billDate 格式需为 YYYY-MM-DD");
  }
  const date = new Date(`${billDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_BILL_DATE", "billDate 不是有效日期");
  }
  return billDate;
}

function toBillView(row) {
  return {
    id: Number(row.id),
    billType: row.bill_type,
    category: row.category,
    amount: Number(row.amount),
    note: row.note,
    billDate: row.bill_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const month = String(req.query.month || "").trim();
    let rows;

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new AppError(400, "INVALID_MONTH", "month 格式需为 YYYY-MM");
      }
      rows = await query(
        `
          SELECT id, bill_type, category, amount, note, bill_date, created_at, updated_at
          FROM bills
          WHERE user_id = ? AND DATE_FORMAT(bill_date, '%Y-%m') = ?
          ORDER BY bill_date DESC, id DESC
        `,
        [req.user.id, month]
      );
    } else {
      rows = await query(
        `
          SELECT id, bill_type, category, amount, note, bill_date, created_at, updated_at
          FROM bills
          WHERE user_id = ?
          ORDER BY bill_date DESC, id DESC
          LIMIT 200
        `,
        [req.user.id]
      );
    }

    const bills = rows.map(toBillView);
    const summary = bills.reduce(
      (acc, bill) => {
        if (bill.billType === "EXPENSE") {
          acc.expense += bill.amount;
        } else {
          acc.income += bill.amount;
        }
        return acc;
      },
      { expense: 0, income: 0 }
    );

    res.json({
      bills,
      summary: {
        expense: Number(summary.expense.toFixed(2)),
        income: Number(summary.income.toFixed(2)),
        balance: Number((summary.income - summary.expense).toFixed(2)),
      },
    });
  })
);

router.post(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const billType = normalizeBillType(req.body.billType);
    const category = normalizeCategory(req.body.category);
    const amount = normalizeAmount(req.body.amount);
    const note = normalizeNote(req.body.note);
    const billDate = normalizeBillDate(req.body.billDate);

    const result = await execute(
      `
        INSERT INTO bills (user_id, bill_type, category, amount, note, bill_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [req.user.id, billType, category, amount, note, billDate]
    );

    const created = await queryOne(
      `
        SELECT id, bill_type, category, amount, note, bill_date, created_at, updated_at
        FROM bills
        WHERE id = ? AND user_id = ?
      `,
      [result.insertId, req.user.id]
    );

    res.status(201).json({
      bill: toBillView(created),
    });
  })
);

router.patch(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, "INVALID_ID", "账单 ID 非法");
    }

    const fields = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "billType")) {
      fields.push("bill_type = ?");
      params.push(normalizeBillType(req.body.billType));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "category")) {
      fields.push("category = ?");
      params.push(normalizeCategory(req.body.category));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "amount")) {
      fields.push("amount = ?");
      params.push(normalizeAmount(req.body.amount));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "note")) {
      fields.push("note = ?");
      params.push(normalizeNote(req.body.note));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "billDate")) {
      fields.push("bill_date = ?");
      params.push(normalizeBillDate(req.body.billDate));
    }

    if (!fields.length) {
      throw new AppError(400, "EMPTY_UPDATE", "没有可更新字段");
    }

    params.push(id, req.user.id);
    const result = await execute(
      `UPDATE bills SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw new AppError(404, "BILL_NOT_FOUND", "账单不存在");
    }

    const bill = await queryOne(
      `
        SELECT id, bill_type, category, amount, note, bill_date, created_at, updated_at
        FROM bills
        WHERE id = ? AND user_id = ?
      `,
      [id, req.user.id]
    );

    res.json({
      bill: toBillView(bill),
    });
  })
);

router.delete(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, "INVALID_ID", "账单 ID 非法");
    }

    const result = await execute("DELETE FROM bills WHERE id = ? AND user_id = ?", [
      id,
      req.user.id,
    ]);

    if (!result.affectedRows) {
      throw new AppError(404, "BILL_NOT_FOUND", "账单不存在");
    }

    res.json({ message: "删除成功" });
  })
);

module.exports = router;
