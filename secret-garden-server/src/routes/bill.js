const express = require("express");
const { execute, query, queryOne } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/async-handler");
const { AppError } = require("../utils/app-error");

const router = express.Router();

const allowedBillTypes = new Set(["EXPENSE", "INCOME"]);
const allowedOverviewScopes = new Set(["MONTH", "YEAR"]);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function normalizeBillType(value) {
  const billType = String(value || "").trim().toUpperCase();
  if (!allowedBillTypes.has(billType)) {
    throw new AppError(400, "INVALID_BILL_TYPE", "billType only supports EXPENSE or INCOME");
  }
  return billType;
}

function normalizeCategory(value) {
  const category = String(value || "").trim();
  if (!category || category.length > 32) {
    throw new AppError(400, "INVALID_CATEGORY", "category is required and must be <= 32 chars");
  }
  return category;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, "INVALID_AMOUNT", "amount must be greater than 0");
  }
  return Number(amount.toFixed(2));
}

function normalizeNote(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const note = String(value).trim();
  if (note.length > 255) {
    throw new AppError(400, "INVALID_NOTE", "note must be <= 255 chars");
  }
  return note || null;
}

function normalizeBillDate(value) {
  const billDate = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billDate)) {
    throw new AppError(400, "INVALID_BILL_DATE", "billDate must be YYYY-MM-DD");
  }
  const date = new Date(`${billDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_BILL_DATE", "billDate is invalid");
  }
  return billDate;
}

function normalizePagination(pageValue, pageSizeValue) {
  const page = pageValue === undefined ? 1 : Number.parseInt(String(pageValue), 10);
  const pageSize =
    pageSizeValue === undefined ? DEFAULT_PAGE_SIZE : Number.parseInt(String(pageSizeValue), 10);

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError(400, "INVALID_PAGE", "page must be an integer >= 1");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new AppError(400, "INVALID_PAGE_SIZE", `pageSize must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function normalizeMonth(value, code = "INVALID_MONTH", message = "month must be YYYY-MM") {
  const month = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError(400, code, message);
  }
  const [year, monthNumber] = month.split("-").map((item) => Number.parseInt(item, 10));
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new AppError(400, code, message);
  }
  return month;
}

function normalizeYear(value) {
  const year = String(value || "").trim();
  if (!/^\d{4}$/.test(year)) {
    throw new AppError(400, "INVALID_YEAR", "year must be YYYY");
  }
  return year;
}

function normalizeOverviewScope(value) {
  const scope = String(value || "MONTH")
    .trim()
    .toUpperCase();
  if (!allowedOverviewScopes.has(scope)) {
    throw new AppError(400, "INVALID_SCOPE", "scope only supports MONTH or YEAR");
  }
  return scope;
}

function getMonthRange(month) {
  const [year, monthNumber] = month.split("-").map((item) => Number.parseInt(item, 10));
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return { start, end };
}

function getYearRange(year) {
  const yearValue = Number.parseInt(year, 10);
  return {
    start: `${year}-01-01`,
    end: `${yearValue + 1}-01-01`,
  };
}

function toAmount(value) {
  return Number(Number(value || 0).toFixed(2));
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
    const monthRaw = String(req.query.month || "").trim();
    const month = monthRaw ? normalizeMonth(monthRaw) : "";

    const { page, pageSize, offset } = normalizePagination(req.query.page, req.query.pageSize);

    const whereParts = ["user_id = ?"];
    const whereParams = [req.user.id];

    if (month) {
      const { start: monthStart, end: nextMonthStart } = getMonthRange(month);
      whereParts.push("bill_date >= ? AND bill_date < ?");
      whereParams.push(monthStart, nextMonthStart);
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    const rows = await query(
      `
        SELECT id, bill_type, category, amount, note, bill_date, created_at, updated_at
        FROM bills
        ${whereSql}
        ORDER BY bill_date DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      whereParams
    );

    const aggregate = await queryOne(
      `
        SELECT
          COUNT(1) AS total,
          COALESCE(SUM(CASE WHEN bill_type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expense,
          COALESCE(SUM(CASE WHEN bill_type = 'INCOME' THEN amount ELSE 0 END), 0) AS income
        FROM bills
        ${whereSql}
      `,
      whereParams
    );

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const { start: currentMonthStart, end: nextMonthStart } = getMonthRange(currentMonth);
    const overviewAggregate = await queryOne(
      `
        SELECT
          COALESCE(SUM(CASE WHEN bill_date >= ? AND bill_date < ? THEN amount ELSE 0 END), 0) AS month_expense,
          COALESCE(SUM(CASE WHEN bill_date = ? THEN amount ELSE 0 END), 0) AS today_expense
        FROM bills
        WHERE user_id = ? AND bill_type = 'EXPENSE'
      `,
      [currentMonthStart, nextMonthStart, today, req.user.id]
    );

    const total = Number(aggregate?.total || 0);
    const expense = toAmount(aggregate?.expense);
    const income = toAmount(aggregate?.income);
    const bills = rows.map(toBillView);

    res.json({
      bills,
      summary: {
        expense,
        income,
        balance: toAmount(income - expense),
        monthExpense: toAmount(overviewAggregate?.month_expense),
        todayExpense: toAmount(overviewAggregate?.today_expense),
      },
      pagination: {
        page,
        pageSize,
        total,
        hasMore: offset + bills.length < total,
      },
    });
  })
);

router.get(
  "/overview/summary",
  authRequired,
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const { start: monthStart, end: nextMonthStart } = getMonthRange(currentMonth);

    const overview = await queryOne(
      `
        SELECT
          COALESCE(SUM(CASE WHEN bill_date >= ? AND bill_date < ? THEN amount ELSE 0 END), 0) AS month_expense,
          COALESCE(SUM(CASE WHEN bill_date = ? THEN amount ELSE 0 END), 0) AS today_expense
        FROM bills
        WHERE user_id = ? AND bill_type = 'EXPENSE'
      `,
      [monthStart, nextMonthStart, today, req.user.id]
    );

    res.json({
      month: currentMonth,
      today,
      monthExpense: toAmount(overview?.month_expense),
      todayExpense: toAmount(overview?.today_expense),
    });
  })
);

router.get(
  "/overview",
  authRequired,
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const currentYear = today.slice(0, 4);
    const scope = normalizeOverviewScope(req.query.scope);

    let periodLabel = "";
    let range;

    if (scope === "YEAR") {
      const year = normalizeYear(req.query.year || currentYear);
      periodLabel = year;
      range = getYearRange(year);
    } else {
      const month = normalizeMonth(req.query.month || currentMonth);
      periodLabel = month;
      range = getMonthRange(month);
    }

    const totalAggregate = await queryOne(
      `
        SELECT COALESCE(SUM(amount), 0) AS total_expense
        FROM bills
        WHERE user_id = ?
          AND bill_type = 'EXPENSE'
          AND bill_date >= ?
          AND bill_date < ?
      `,
      [req.user.id, range.start, range.end]
    );

    const categoryRows = await query(
      `
        SELECT category, COALESCE(SUM(amount), 0) AS total_amount
        FROM bills
        WHERE user_id = ?
          AND bill_type = 'EXPENSE'
          AND bill_date >= ?
          AND bill_date < ?
        GROUP BY category
        ORDER BY total_amount DESC, category ASC
      `,
      [req.user.id, range.start, range.end]
    );

    const topRows = await query(
      `
        SELECT id, bill_type, category, amount, note, bill_date, created_at, updated_at
        FROM bills
        WHERE user_id = ?
          AND bill_type = 'EXPENSE'
          AND bill_date >= ?
          AND bill_date < ?
        ORDER BY amount DESC, bill_date DESC, id DESC
        LIMIT 10
      `,
      [req.user.id, range.start, range.end]
    );

    res.json({
      scope,
      period: {
        label: periodLabel,
        start: range.start,
        endExclusive: range.end,
      },
      totalExpense: toAmount(totalAggregate?.total_expense),
      categories: categoryRows.map((row) => ({
        category: row.category,
        amount: toAmount(row.total_amount),
      })),
      topExpenses: topRows.map(toBillView),
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

router.get(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, "INVALID_ID", "invalid bill id");
    }

    const bill = await queryOne(
      `
        SELECT id, bill_type, category, amount, note, bill_date, created_at, updated_at
        FROM bills
        WHERE id = ? AND user_id = ?
      `,
      [id, req.user.id]
    );

    if (!bill) {
      throw new AppError(404, "BILL_NOT_FOUND", "bill not found");
    }

    res.json({
      bill: toBillView(bill),
    });
  })
);

router.patch(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, "INVALID_ID", "invalid bill id");
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
      throw new AppError(400, "EMPTY_UPDATE", "no updatable fields");
    }

    params.push(id, req.user.id);
    const result = await execute(
      `UPDATE bills SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw new AppError(404, "BILL_NOT_FOUND", "bill not found");
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
      throw new AppError(400, "INVALID_ID", "invalid bill id");
    }

    const result = await execute("DELETE FROM bills WHERE id = ? AND user_id = ?", [
      id,
      req.user.id,
    ]);

    if (!result.affectedRows) {
      throw new AppError(404, "BILL_NOT_FOUND", "bill not found");
    }

    res.json({ message: "deleted" });
  })
);

module.exports = router;
