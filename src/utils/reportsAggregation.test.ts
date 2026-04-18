import { describe, expect, it } from 'vitest';
import { Expense, Order } from '../../types';
import {
  aggregateFromPreAggregatedData,
  aggregateFromRawData,
  getOrderTaxAmount,
  getRangeKeys,
  isRealizedOrder,
  toISTDateKey
} from './reportsAggregation';

const makeOrder = (overrides: Partial<Order>): Order => ({
  id: 'o1',
  restaurantId: 'r1',
  items: [
    {
      id: 'm1',
      name: 'Burger',
      description: '',
      image: '',
      categoryGroup: 'Main',
      price: 100,
      quantity: 2
    }
  ],
  total: 236,
  subtotal: 200,
  discount: 10,
  deliveryCharge: 20,
  status: 'Completed',
  orderType: 'Delivery',
  createdAt: '2026-04-10T18:40:00.000Z',
  paymentStatus: 'Paid',
  paymentMethod: 'Online',
  taxDetails: {
    gstRate: 5,
    gstAmount: 6,
    serviceRate: 0,
    serviceAmount: 0
  },
  ...overrides
});

describe('reportsAggregation', () => {
  it('uses IST date bucketing correctly near midnight', () => {
    const key = toISTDateKey('2026-04-10T18:40:00.000Z');
    expect(key).toBe('2026-04-11');
  });

  it('realized filter only includes completed + paid', () => {
    expect(isRealizedOrder(makeOrder({ status: 'Completed', paymentStatus: 'Paid' }))).toBe(true);
    expect(isRealizedOrder(makeOrder({ status: 'Completed', paymentStatus: 'Pending' }))).toBe(false);
    expect(isRealizedOrder(makeOrder({ status: 'Pending', paymentStatus: 'Paid' }))).toBe(false);
  });

  it('extracts tax amount from gst/service amount fields', () => {
    const tax = getOrderTaxAmount(
      makeOrder({
        taxDetails: {
          gstRate: 5,
          gstAmount: 12,
          serviceRate: 10,
          serviceAmount: 8
        }
      })
    );
    expect(tax).toBe(20);
  });

  it('aggregates raw data into daily rows and KPI totals', () => {
    const orders: Order[] = [
      makeOrder({ id: 'o1', total: 236, subtotal: 200, createdAt: '2026-04-10T18:40:00.000Z' }),
      makeOrder({
        id: 'o2',
        total: 118,
        subtotal: 100,
        createdAt: '2026-04-11T08:00:00.000Z',
        paymentMethod: 'Cash',
        orderType: 'Dine-in'
      }),
      makeOrder({
        id: 'o3',
        total: 150,
        subtotal: 120,
        createdAt: '2026-04-11T08:20:00.000Z',
        paymentStatus: 'Pending'
      })
    ];

    const expenses: Expense[] = [
      { id: 'e1', title: 'Milk', amount: 100, category: 'Stock', date: '2026-04-11T10:00:00.000Z' }
    ];

    const result = aggregateFromRawData(orders, expenses, '2026-04-11', '2026-04-11');

    expect(result.filteredRealized.length).toBe(2);
    expect(result.kpis.realizedRevenue).toBe(354);
    expect(result.kpis.ordersCount).toBe(2);
    expect(result.kpis.totalExpenses).toBe(100);
    expect(result.kpis.netProfit).toBe(254);
    expect(result.dailyRows[0].dateKey).toBe('2026-04-11');
  });

  it('aggregates pre-aggregated docs and merges breakdowns', () => {
    const result = aggregateFromPreAggregatedData(
      [
        {
          dateKey: '2026-04-11',
          realizedRevenue: 1000,
          operationalRevenue: 1300,
          ordersCompletedPaid: 10,
          discountTotal: 50,
          taxTotal: 60,
          deliveryChargeTotal: 40,
          expensesTotal: 400,
          paymentBreakdown: { Cash: 500, Online: 500 },
          orderTypeBreakdown: { Delivery: 700, 'Dine-in': 300 },
          statusBreakdown: { Completed: 10, Pending: 2 }
        }
      ],
      '2026-04-01',
      '2026-04-30'
    );

    expect(result.kpis.realizedRevenue).toBe(1000);
    expect(result.kpis.netProfit).toBe(600);
    expect(result.paymentBreakdown.length).toBe(2);
    expect(result.statusBreakdown.find((row) => row.key === 'Pending')?.value).toBe(2);
  });

  it('returns null for invalid custom range', () => {
    const range = getRangeKeys('custom', '2026-05-10', '2026-05-01');
    expect(range).toBeNull();
  });
});

