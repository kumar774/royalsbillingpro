import { Expense, Order } from '../../types';

export interface BreakdownRow {
  key: string;
  value: number;
}

export interface TopItemRow {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DailyReportRow {
  dateKey: string;
  ordersCount: number;
  grossSales: number;
  discounts: number;
  deliveryCharges: number;
  taxTotal: number;
  netSales: number;
  expenses: number;
  netProfit: number;
  aov: number;
  operationalRevenue: number;
}

export interface KpiMetrics {
  realizedRevenue: number;
  operationalRevenue: number;
  netProfit: number;
  ordersCount: number;
  aov: number;
  totalDiscounts: number;
  taxCollected: number;
  deliveryCharges: number;
  totalExpenses: number;
  expenseRatio: number;
}

export interface PreAggregatedDailyDoc {
  dateKey: string;
  tz?: string;
  realizedRevenue?: number;
  operationalRevenue?: number;
  ordersCompletedPaid?: number;
  ordersNonCancelled?: number;
  discountTotal?: number;
  taxTotal?: number;
  deliveryChargeTotal?: number;
  expensesTotal?: number;
  netProfit?: number;
  paymentBreakdown?: Record<string, number>;
  orderTypeBreakdown?: Record<string, number>;
  statusBreakdown?: Record<string, number>;
  topItems?: TopItemRow[];
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export const toISTDateKey = (value: Date | string): string => {
  return IST_DATE_FORMATTER.format(toDate(value));
};

export const isOperationalOrder = (order: Order): boolean => order.status !== 'Cancelled';

export const isRealizedOrder = (order: Order): boolean =>
  order.status === 'Completed' && order.paymentStatus === 'Paid';

export const getOrderSubtotal = (order: Order): number => {
  if (typeof order.subtotal === 'number') return order.subtotal;
  return order.items.reduce(
    (sum, item) => sum + (Number(item.selectedVariant?.price ?? item.price) || 0) * (item.quantity || 0),
    0
  );
};

export const getOrderTaxAmount = (order: Order): number => {
  const tax = order.taxDetails;
  if (!tax) return 0;

  const gstAmount = typeof tax.gstAmount === 'number' ? tax.gstAmount : 0;
  const serviceAmount = typeof tax.serviceAmount === 'number' ? tax.serviceAmount : 0;
  if (gstAmount || serviceAmount) return gstAmount + serviceAmount;

  return Object.entries(tax).reduce((sum, [key, value]) => {
    if (typeof value !== 'number') return sum;
    if (key.toLowerCase().includes('rate')) return sum;
    return sum + value;
  }, 0);
};

export const mapBreakdownRecord = (record: Record<string, number> | undefined): BreakdownRow[] => {
  if (!record) return [];
  return Object.entries(record)
    .map(([key, value]) => ({ key, value: Number(value) || 0 }))
    .filter((row) => row.value > 0);
};

export const getRangeKeys = (
  range: 'today' | 'last7' | 'thisMonth' | 'custom',
  customStart: string,
  customEnd: string,
  now = new Date()
): { startKey: string; endKey: string } | null => {
  const nowKey = toISTDateKey(now);

  if (range === 'today') {
    return { startKey: nowKey, endKey: nowKey };
  }

  if (range === 'last7') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startKey: toISTDateKey(start), endKey: nowKey };
  }

  if (range === 'thisMonth') {
    const nowDate = toDate(now);
    const monthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1));
    return { startKey: toISTDateKey(monthStart), endKey: nowKey };
  }

  if (!customStart || !customEnd) return null;
  if (customStart > customEnd) return null;
  return { startKey: customStart, endKey: customEnd };
};

const toBreakdownRows = (map: Map<string, number>): BreakdownRow[] =>
  Array.from(map.entries())
    .map(([key, value]) => ({ key, value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

export interface AggregationResult {
  dailyRows: DailyReportRow[];
  kpis: KpiMetrics;
  filteredOperational: Order[];
  filteredRealized: Order[];
  rangeOrders: Order[];
  rangeExpenses: Expense[];
  paymentBreakdown: BreakdownRow[];
  orderTypeBreakdown: BreakdownRow[];
  statusBreakdown: BreakdownRow[];
  topItems: TopItemRow[];
}

export const aggregateFromRawData = (
  orders: Order[],
  expenses: Expense[],
  startKey: string,
  endKey: string
): AggregationResult => {
  const rangeOrders = orders.filter((order) => {
    const key = toISTDateKey(order.createdAt);
    return key >= startKey && key <= endKey;
  });

  const rangeExpenses = expenses.filter((expense) => {
    const key = toISTDateKey(expense.date);
    return key >= startKey && key <= endKey;
  });

  const filteredOperational = rangeOrders.filter(isOperationalOrder);
  const filteredRealized = rangeOrders.filter(isRealizedOrder);

  const dailyMap = new Map<string, DailyReportRow>();
  const paymentMap = new Map<string, number>();
  const orderTypeMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const topItemsMap = new Map<string, TopItemRow>();

  filteredOperational.forEach((order) => {
    const dateKey = toISTDateKey(order.createdAt);
    const row = dailyMap.get(dateKey) || {
      dateKey,
      ordersCount: 0,
      grossSales: 0,
      discounts: 0,
      deliveryCharges: 0,
      taxTotal: 0,
      netSales: 0,
      expenses: 0,
      netProfit: 0,
      aov: 0,
      operationalRevenue: 0
    };
    row.operationalRevenue += Number(order.total) || 0;
    dailyMap.set(dateKey, row);
  });

  filteredRealized.forEach((order) => {
    const dateKey = toISTDateKey(order.createdAt);
    const subtotal = getOrderSubtotal(order);
    const discount = Number(order.discount) || 0;
    const delivery = Number(order.deliveryCharge) || 0;
    const tax = getOrderTaxAmount(order);
    const total = Number(order.total) || 0;

    const row = dailyMap.get(dateKey) || {
      dateKey,
      ordersCount: 0,
      grossSales: 0,
      discounts: 0,
      deliveryCharges: 0,
      taxTotal: 0,
      netSales: 0,
      expenses: 0,
      netProfit: 0,
      aov: 0,
      operationalRevenue: 0
    };

    row.ordersCount += 1;
    row.grossSales += subtotal;
    row.discounts += discount;
    row.deliveryCharges += delivery;
    row.taxTotal += tax;
    row.netSales += total;
    dailyMap.set(dateKey, row);

    const paymentKey = order.paymentMethod || 'Unknown';
    paymentMap.set(paymentKey, (paymentMap.get(paymentKey) || 0) + total);

    const typeKey = order.orderType || 'Unknown';
    orderTypeMap.set(typeKey, (orderTypeMap.get(typeKey) || 0) + total);

    order.items.forEach((item) => {
      const rowItem = topItemsMap.get(item.id) || {
        id: item.id,
        name: item.name,
        quantity: 0,
        revenue: 0
      };
      const unitPrice = Number(item.selectedVariant?.price ?? item.price) || 0;
      const qty = item.quantity || 0;
      rowItem.quantity += qty;
      rowItem.revenue += unitPrice * qty;
      topItemsMap.set(item.id, rowItem);
    });
  });

  rangeOrders.forEach((order) => {
    const key = order.status || 'Unknown';
    statusMap.set(key, (statusMap.get(key) || 0) + 1);
  });

  rangeExpenses.forEach((expense) => {
    const dateKey = toISTDateKey(expense.date);
    const row = dailyMap.get(dateKey) || {
      dateKey,
      ordersCount: 0,
      grossSales: 0,
      discounts: 0,
      deliveryCharges: 0,
      taxTotal: 0,
      netSales: 0,
      expenses: 0,
      netProfit: 0,
      aov: 0,
      operationalRevenue: 0
    };
    row.expenses += Number(expense.amount) || 0;
    dailyMap.set(dateKey, row);
  });

  const dailyRows = Array.from(dailyMap.values())
    .map((row) => ({
      ...row,
      netProfit: row.netSales - row.expenses,
      aov: row.ordersCount > 0 ? row.netSales / row.ordersCount : 0
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const realizedRevenue = dailyRows.reduce((sum, row) => sum + row.netSales, 0);
  const operationalRevenue = dailyRows.reduce((sum, row) => sum + row.operationalRevenue, 0);
  const totalExpenses = dailyRows.reduce((sum, row) => sum + row.expenses, 0);
  const ordersCount = dailyRows.reduce((sum, row) => sum + row.ordersCount, 0);
  const totalDiscounts = dailyRows.reduce((sum, row) => sum + row.discounts, 0);
  const taxCollected = dailyRows.reduce((sum, row) => sum + row.taxTotal, 0);
  const deliveryCharges = dailyRows.reduce((sum, row) => sum + row.deliveryCharges, 0);
  const netProfit = realizedRevenue - totalExpenses;
  const aov = ordersCount > 0 ? realizedRevenue / ordersCount : 0;
  const expenseRatio = realizedRevenue > 0 ? (totalExpenses / realizedRevenue) * 100 : 0;

  const topItems = Array.from(topItemsMap.values()).sort((a, b) => b.revenue - a.revenue);

  return {
    dailyRows,
    kpis: {
      realizedRevenue,
      operationalRevenue,
      netProfit,
      ordersCount,
      aov,
      totalDiscounts,
      taxCollected,
      deliveryCharges,
      totalExpenses,
      expenseRatio
    },
    filteredOperational,
    filteredRealized,
    rangeOrders,
    rangeExpenses,
    paymentBreakdown: toBreakdownRows(paymentMap),
    orderTypeBreakdown: toBreakdownRows(orderTypeMap),
    statusBreakdown: toBreakdownRows(statusMap),
    topItems
  };
};

export interface PreAggregatedResult {
  dailyRows: DailyReportRow[];
  kpis: KpiMetrics;
  paymentBreakdown: BreakdownRow[];
  orderTypeBreakdown: BreakdownRow[];
  statusBreakdown: BreakdownRow[];
  topItems: TopItemRow[];
}

export const aggregateFromPreAggregatedData = (
  docs: PreAggregatedDailyDoc[],
  startKey: string,
  endKey: string
): PreAggregatedResult => {
  const rows = docs
    .filter((doc) => doc.dateKey >= startKey && doc.dateKey <= endKey)
    .map((doc) => {
      const netSales = Number(doc.realizedRevenue) || 0;
      const expenses = Number(doc.expensesTotal) || 0;
      const ordersCount = Number(doc.ordersCompletedPaid) || 0;
      return {
        dateKey: doc.dateKey,
        ordersCount,
        grossSales: netSales,
        discounts: Number(doc.discountTotal) || 0,
        deliveryCharges: Number(doc.deliveryChargeTotal) || 0,
        taxTotal: Number(doc.taxTotal) || 0,
        netSales,
        expenses,
        netProfit: Number(doc.netProfit) || netSales - expenses,
        aov: ordersCount > 0 ? netSales / ordersCount : 0,
        operationalRevenue: Number(doc.operationalRevenue) || 0
      } as DailyReportRow;
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const paymentMap = new Map<string, number>();
  const orderTypeMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const topItemsMap = new Map<string, TopItemRow>();

  docs
    .filter((doc) => doc.dateKey >= startKey && doc.dateKey <= endKey)
    .forEach((doc) => {
      mapBreakdownRecord(doc.paymentBreakdown).forEach((row) => {
        paymentMap.set(row.key, (paymentMap.get(row.key) || 0) + row.value);
      });
      mapBreakdownRecord(doc.orderTypeBreakdown).forEach((row) => {
        orderTypeMap.set(row.key, (orderTypeMap.get(row.key) || 0) + row.value);
      });
      mapBreakdownRecord(doc.statusBreakdown).forEach((row) => {
        statusMap.set(row.key, (statusMap.get(row.key) || 0) + row.value);
      });

      (doc.topItems || []).forEach((item) => {
        const prev = topItemsMap.get(item.id) || { ...item, quantity: 0, revenue: 0 };
        prev.quantity += Number(item.quantity) || 0;
        prev.revenue += Number(item.revenue) || 0;
        topItemsMap.set(item.id, prev);
      });
    });

  const realizedRevenue = rows.reduce((sum, row) => sum + row.netSales, 0);
  const operationalRevenue = rows.reduce((sum, row) => sum + row.operationalRevenue, 0);
  const totalExpenses = rows.reduce((sum, row) => sum + row.expenses, 0);
  const ordersCount = rows.reduce((sum, row) => sum + row.ordersCount, 0);
  const totalDiscounts = rows.reduce((sum, row) => sum + row.discounts, 0);
  const taxCollected = rows.reduce((sum, row) => sum + row.taxTotal, 0);
  const deliveryCharges = rows.reduce((sum, row) => sum + row.deliveryCharges, 0);
  const netProfit = realizedRevenue - totalExpenses;
  const aov = ordersCount > 0 ? realizedRevenue / ordersCount : 0;
  const expenseRatio = realizedRevenue > 0 ? (totalExpenses / realizedRevenue) * 100 : 0;

  return {
    dailyRows: rows,
    kpis: {
      realizedRevenue,
      operationalRevenue,
      netProfit,
      ordersCount,
      aov,
      totalDiscounts,
      taxCollected,
      deliveryCharges,
      totalExpenses,
      expenseRatio
    },
    paymentBreakdown: toBreakdownRows(paymentMap),
    orderTypeBreakdown: toBreakdownRows(orderTypeMap),
    statusBreakdown: toBreakdownRows(statusMap),
    topItems: Array.from(topItemsMap.values()).sort((a, b) => b.revenue - a.revenue)
  };
};

