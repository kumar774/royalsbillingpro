import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { Download, Loader2, Printer, X } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import * as XLSX from 'xlsx';
import { db } from '../firebase/config';
import { Expense, Order } from '../types';
import {
  DailyReportRow,
  TopItemRow,
  aggregateFromPreAggregatedData,
  aggregateFromRawData,
  getOrderTaxAmount,
  getRangeKeys,
  toISTDateKey
} from '../src/utils/reportsAggregation';

type RangeType = 'today' | 'last7' | 'thisMonth' | 'custom';
type TopMode = 'revenue' | 'quantity';

interface PreAggDoc {
  dateKey: string;
  realizedRevenue?: number;
  operationalRevenue?: number;
  ordersCompletedPaid?: number;
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

interface DayDrilldownData {
  dateKey: string;
  orders: Order[];
  expenses: Expense[];
  paymentBreakdown: { key: string; value: number }[];
  topItems: TopItemRow[];
}

const tz = 'Asia/Kolkata';
const dateFmt = new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: '2-digit', month: 'short' });
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

const Reports: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [range, setRange] = useState<RangeType>('thisMonth');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [topMode, setTopMode] = useState<TopMode>('revenue');

  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [preAggDocs, setPreAggDocs] = useState<PreAggDoc[]>([]);
  const [loadingPreAgg, setLoadingPreAgg] = useState(true);
  const [loadingRaw, setLoadingRaw] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DayDrilldownData | null>(null);

  const rangeKeys = useMemo(() => getRangeKeys(range, customStart, customEnd), [range, customStart, customEnd]);

  useEffect(() => {
    if (range !== 'custom') {
      setRangeError(null);
      return;
    }
    if (!rangeKeys) {
      setRangeError('Please select valid custom start/end dates.');
      return;
    }
    const start = new Date(`${rangeKeys.startKey}T00:00:00+05:30`);
    const end = new Date(`${rangeKeys.endKey}T00:00:00+05:30`);
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 366) {
      setRangeError('Custom range can be maximum 366 days.');
      return;
    }
    setRangeError(null);
  }, [range, rangeKeys]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoadingPreAgg(true);
    const unsub = onSnapshot(
      collection(db, 'restaurants', restaurantId, 'reportDaily'),
      (snap) => {
        setPreAggDocs(snap.docs.map((d) => ({ dateKey: d.id, ...d.data() } as PreAggDoc)));
        setLoadingPreAgg(false);
      },
      () => setLoadingPreAgg(false)
    );
    return () => unsub();
  }, [restaurantId]);

  const hasPreAggInRange = useMemo(() => {
    if (!rangeKeys) return false;
    return preAggDocs.some((d) => d.dateKey >= rangeKeys.startKey && d.dateKey <= rangeKeys.endKey);
  }, [preAggDocs, rangeKeys]);

  useEffect(() => {
    if (!restaurantId || !rangeKeys) return;
    if (hasPreAggInRange) {
      setLoadingRaw(false);
      return;
    }
    setLoadingRaw(true);
    const unsubOrders = onSnapshot(collection(db, 'restaurants', restaurantId, 'orders'), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      setLoadingRaw(false);
    });
    const unsubExpenses = onSnapshot(collection(db, 'restaurants', restaurantId, 'expenses'), (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
    });
    return () => {
      unsubOrders();
      unsubExpenses();
    };
  }, [restaurantId, rangeKeys, hasPreAggInRange]);

  const model = useMemo(() => {
    if (!rangeKeys) return null;
    if (hasPreAggInRange) {
      return {
        mode: 'preagg' as const,
        ...aggregateFromPreAggregatedData(preAggDocs, rangeKeys.startKey, rangeKeys.endKey),
        rangeOrders: [] as Order[],
        rangeExpenses: [] as Expense[]
      };
    }
    return {
      mode: 'raw' as const,
      ...aggregateFromRawData(orders, expenses, rangeKeys.startKey, rangeKeys.endKey)
    };
  }, [rangeKeys, hasPreAggInRange, preAggDocs, orders, expenses]);

  const loading = loadingPreAgg || loadingRaw;

  const periodLabel = useMemo(() => {
    if (!rangeKeys) return 'Invalid period';
    return `${dateFmt.format(new Date(`${rangeKeys.startKey}T00:00:00+05:30`))} - ${dateFmt.format(
      new Date(`${rangeKeys.endKey}T00:00:00+05:30`)
    )} (IST)`;
  }, [rangeKeys]);

  const topItems = useMemo(() => {
    if (!model) return [];
    const list = [...model.topItems];
    return topMode === 'revenue' ? list.sort((a, b) => b.revenue - a.revenue) : list.sort((a, b) => b.quantity - a.quantity);
  }, [model, topMode]);

  const openDrilldown = async (row: DailyReportRow) => {
    if (!restaurantId) return;
    let localOrders = orders;
    let localExpenses = expenses;

    if (model?.mode === 'preagg') {
      const [oSnap, eSnap] = await Promise.all([
        getDocs(collection(db, 'restaurants', restaurantId, 'orders')),
        getDocs(collection(db, 'restaurants', restaurantId, 'expenses'))
      ]);
      localOrders = oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      localExpenses = eSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
    }

    const dayOrders = localOrders.filter((o) => toISTDateKey(o.createdAt) === row.dateKey);
    const dayExpenses = localExpenses.filter((e) => toISTDateKey(e.date) === row.dateKey);
    const realized = dayOrders.filter((o) => o.status === 'Completed' && o.paymentStatus === 'Paid');

    const pMap = new Map<string, number>();
    const iMap = new Map<string, TopItemRow>();
    realized.forEach((o) => {
      const p = o.paymentMethod || 'Unknown';
      pMap.set(p, (pMap.get(p) || 0) + (Number(o.total) || 0));
      o.items.forEach((it) => {
        const prev = iMap.get(it.id) || { id: it.id, name: it.name, quantity: 0, revenue: 0 };
        const qty = it.quantity || 0;
        const unit = Number(it.selectedVariant?.price ?? it.price) || 0;
        prev.quantity += qty;
        prev.revenue += qty * unit;
        iMap.set(it.id, prev);
      });
    });

    setDrilldown({
      dateKey: row.dateKey,
      orders: dayOrders,
      expenses: dayExpenses,
      paymentBreakdown: Array.from(pMap.entries()).map(([key, value]) => ({ key, value })),
      topItems: Array.from(iMap.values()).sort((a, b) => b.revenue - a.revenue)
    });
  };

  const exportExcel = async () => {
    if (!model || !rangeKeys || !restaurantId) return;
    setExporting(true);
    try {
      let o = model.rangeOrders;
      let e = model.rangeExpenses;
      if (model.mode === 'preagg') {
        const [oSnap, eSnap] = await Promise.all([
          getDocs(collection(db, 'restaurants', restaurantId, 'orders')),
          getDocs(collection(db, 'restaurants', restaurantId, 'expenses'))
        ]);
        o = oSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Order))
          .filter((x) => {
            const k = toISTDateKey(x.createdAt);
            return k >= rangeKeys.startKey && k <= rangeKeys.endKey;
          });
        e = eSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Expense))
          .filter((x) => {
            const k = toISTDateKey(x.date);
            return k >= rangeKeys.startKey && k <= rangeKeys.endKey;
          });
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Executive Summary'],
          ['Period', periodLabel],
          ['Realized Revenue', model.kpis.realizedRevenue],
          ['Operational Revenue', model.kpis.operationalRevenue],
          ['Net Profit', model.kpis.netProfit],
          ['Orders', model.kpis.ordersCount],
          ['AOV', model.kpis.aov],
          ['Discounts', model.kpis.totalDiscounts],
          ['Tax Collected', model.kpis.taxCollected],
          ['Delivery Charges', model.kpis.deliveryCharges],
          ['Expenses', model.kpis.totalExpenses],
          ['Expense Ratio %', model.kpis.expenseRatio]
        ]),
        'Executive Summary'
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Date', 'Orders', 'Gross', 'Discount', 'Delivery', 'Tax', 'Net Sales', 'Expenses', 'Profit', 'AOV', 'Operational'],
          ...model.dailyRows.map((d) => [
            d.dateKey,
            d.ordersCount,
            d.grossSales,
            d.discounts,
            d.deliveryCharges,
            d.taxTotal,
            d.netSales,
            d.expenses,
            d.netProfit,
            d.aov,
            d.operationalRevenue
          ])
        ]),
        'Daily Summary'
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Date', 'Order ID', 'Status', 'Payment', 'Method', 'Type', 'Subtotal', 'Discount', 'Tax', 'Delivery', 'Total'],
          ...o.map((x) => [
            toISTDateKey(x.createdAt),
            x.formattedId || x.id,
            x.status,
            x.paymentStatus || 'N/A',
            x.paymentMethod || 'N/A',
            x.orderType || 'N/A',
            Number(x.subtotal) || 0,
            Number(x.discount) || 0,
            getOrderTaxAmount(x),
            Number(x.deliveryCharge) || 0,
            Number(x.total) || 0
          ])
        ]),
        'Order Details'
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Date', 'Title', 'Category', 'Amount'],
          ...e.map((x) => [toISTDateKey(x.date), x.title, x.category, Number(x.amount) || 0])
        ]),
        'Expense Details'
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([['Item', 'Qty', 'Revenue'], ...topItems.map((x) => [x.name, x.quantity, x.revenue])]),
        'Item Performance'
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Breakdown', 'Key', 'Value'],
          ...model.paymentBreakdown.map((x) => ['Payment Method', x.key, x.value]),
          ...model.orderTypeBreakdown.map((x) => ['Order Type', x.key, x.value]),
          ...model.statusBreakdown.map((x) => ['Order Status', x.key, x.value])
        ]),
        'Breakdowns'
      );

      XLSX.writeFile(wb, `restaurant_report_pro_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (rangeError) {
    return (
      <div className="bg-white rounded-xl border border-red-100 p-8 text-center">
        <h3 className="text-lg font-bold text-red-700">Invalid Date Range</h3>
        <p className="text-red-600 text-sm mt-1">{rangeError}</p>
      </div>
    );
  }

  if (!rangeKeys || !model || model.dailyRows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <h3 className="text-lg font-bold text-gray-900">No financial activity in selected period</h3>
        <p className="text-gray-500 text-sm mt-1">Try changing range filters.</p>
      </div>
    );
  }

  const trend = model.dailyRows.map((d) => ({
    ...d,
    day: dayFmt.format(new Date(`${d.dateKey}T00:00:00+05:30`))
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pro Financial Reports</h2>
          <p className="text-sm text-gray-500">{periodLabel}</p>
          <p className="text-xs text-gray-400">
            Source: {model.mode === 'preagg' ? 'Pre-aggregated daily docs' : 'Live raw data fallback'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
            {[
              ['today', 'Today'],
              ['last7', 'Last 7 Days'],
              ['thisMonth', 'This Month'],
              ['custom', 'Custom']
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRange(k as RangeType)}
                className={`px-3 py-2 text-sm ${range === k ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <>
              <input className="border rounded px-2 py-2 text-sm" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <input className="border rounded px-2 py-2 text-sm" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg border text-sm bg-gray-100 hover:bg-gray-200 flex items-center">
            <Printer className="h-4 w-4 mr-2" /> Print
          </button>
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="px-4 py-2 rounded-lg text-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center disabled:opacity-70"
          >
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Excel Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title="Realized Revenue" value={money.format(model.kpis.realizedRevenue)} sub="Completed + Paid" />
        <Card title="Net Profit" value={money.format(model.kpis.netProfit)} sub={`Expense ratio ${model.kpis.expenseRatio.toFixed(2)}%`} />
        <Card title="Orders" value={`${model.kpis.ordersCount}`} sub={`AOV ${money.format(model.kpis.aov)}`} />
        <Card title="Operational Revenue" value={money.format(model.kpis.operationalRevenue)} sub="Non-cancelled orders" />
        <Card title="Discounts" value={money.format(model.kpis.totalDiscounts)} />
        <Card title="Tax Collected" value={money.format(model.kpis.taxCollected)} />
        <Card title="Delivery Charges" value={money.format(model.kpis.deliveryCharges)} />
        <Card title="Expenses" value={money.format(model.kpis.totalExpenses)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:hidden">
        <Panel title="Daily Trend (Sales/Expenses/Profit)">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(v: number) => money.format(v)} />
              <Legend />
              <Area dataKey="netSales" stroke="#22c55e" fill="#bbf7d0" name="Net Sales" />
              <Area dataKey="expenses" stroke="#ef4444" fill="#fecaca" name="Expenses" />
              <Area dataKey="netProfit" stroke="#3b82f6" fill="#bfdbfe" name="Net Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Payment Method Breakdown">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={model.paymentBreakdown} dataKey="value" nameKey="key" outerRadius={90}>
                {model.paymentBreakdown.map((_, i) => (
                  <Cell key={i} fill={['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'][i % 4]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => money.format(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Order Type Revenue Split">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={model.orderTypeBreakdown}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="key" />
              <YAxis />
              <Tooltip formatter={(v: number) => money.format(v)} />
              <Bar dataKey="value" fill="#ea580c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Order Status Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={model.statusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="key" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Top Items">
        <div className="flex justify-end mb-3">
          <div className="inline-flex border rounded-lg overflow-hidden">
            <button onClick={() => setTopMode('revenue')} className={`px-3 py-1.5 text-sm ${topMode === 'revenue' ? 'bg-gray-100 font-bold' : ''}`}>
              By Revenue
            </button>
            <button onClick={() => setTopMode('quantity')} className={`px-3 py-1.5 text-sm ${topMode === 'quantity' ? 'bg-gray-100 font-bold' : ''}`}>
              By Quantity
            </button>
          </div>
        </div>
        <table className="min-w-full text-sm">
          <thead className="text-gray-500 border-b">
            <tr>
              <th className="py-2 text-left">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topItems.slice(0, 10).map((i) => (
              <tr key={i.id} className="border-b border-gray-50">
                <td className="py-2">{i.name}</td>
                <td className="py-2 text-right">{i.quantity}</td>
                <td className="py-2 text-right">{money.format(i.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Daily P&L Summary (click row for drilldown)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-gray-500 border-b">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Net Sales</th>
                <th className="px-3 py-2 text-right">Expenses</th>
                <th className="px-3 py-2 text-right">Profit</th>
                <th className="px-3 py-2 text-right">AOV</th>
              </tr>
            </thead>
            <tbody>
              {model.dailyRows.map((d) => (
                <tr key={d.dateKey} onClick={() => openDrilldown(d)} className="border-b border-gray-50 hover:bg-orange-50 cursor-pointer">
                  <td className="px-3 py-2">{dateFmt.format(new Date(`${d.dateKey}T00:00:00+05:30`))}</td>
                  <td className="px-3 py-2 text-right">{d.ordersCount}</td>
                  <td className="px-3 py-2 text-right">{money.format(d.grossSales)}</td>
                  <td className="px-3 py-2 text-right text-red-600">-{money.format(d.discounts)}</td>
                  <td className="px-3 py-2 text-right">{money.format(d.taxTotal)}</td>
                  <td className="px-3 py-2 text-right">{money.format(d.netSales)}</td>
                  <td className="px-3 py-2 text-right text-red-600">{money.format(d.expenses)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${d.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{money.format(d.netProfit)}</td>
                  <td className="px-3 py-2 text-right">{money.format(d.aov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {drilldown && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold">Day Drilldown: {dateFmt.format(new Date(`${drilldown.dateKey}T00:00:00+05:30`))}</h3>
              <button onClick={() => setDrilldown(null)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-5 overflow-auto max-h-[calc(90vh-60px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title={`Orders (${drilldown.orders.length})`}>
                  <div className="max-h-64 overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-gray-500 border-b"><tr><th className="text-left py-2">ID</th><th className="text-left py-2">Status</th><th className="text-right py-2">Total</th></tr></thead>
                      <tbody>{drilldown.orders.map((o) => <tr key={o.id} className="border-b border-gray-50"><td className="py-2">{o.formattedId || o.id.slice(0, 8)}</td><td className="py-2">{o.status}</td><td className="py-2 text-right">{money.format(Number(o.total) || 0)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Panel>
                <Panel title={`Expenses (${drilldown.expenses.length})`}>
                  <div className="max-h-64 overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-gray-500 border-b"><tr><th className="text-left py-2">Title</th><th className="text-left py-2">Category</th><th className="text-right py-2">Amount</th></tr></thead>
                      <tbody>{drilldown.expenses.map((e) => <tr key={e.id} className="border-b border-gray-50"><td className="py-2">{e.title}</td><td className="py-2">{e.category}</td><td className="py-2 text-right">{money.format(Number(e.amount) || 0)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Panel>
                <Panel title="Payment Split">
                  <ul className="space-y-2 text-sm">
                    {drilldown.paymentBreakdown.length === 0 && <li className="text-gray-500">No realized sales on this day.</li>}
                    {drilldown.paymentBreakdown.map((p) => (
                      <li key={p.key} className="flex justify-between">
                        <span>{p.key}</span>
                        <span className="font-medium">{money.format(p.value)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Top Items (Day)">
                  <ul className="space-y-2 text-sm">
                    {drilldown.topItems.length === 0 && <li className="text-gray-500">No item sales on this day.</li>}
                    {drilldown.topItems.slice(0, 8).map((i) => (
                      <li key={i.id} className="flex justify-between">
                        <span>{i.name}</span>
                        <span className="font-medium">
                          {i.quantity} qty / {money.format(i.revenue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Card: React.FC<{ title: string; value: string; sub?: string }> = ({ title, value, sub }) => (
  <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
    <p className="text-sm text-gray-500">{title}</p>
    <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
    <h3 className="font-bold text-gray-900 mb-3">{title}</h3>
    {children}
  </div>
);

export default Reports;

