import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { Download, Loader2, Printer, X, ChevronDown, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
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
import { useRestaurants } from '../context/RestaurantContext';
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
  const { restaurants } = useRestaurants();

  const [range, setRange] = useState<RangeType>('thisMonth');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [topMode, setTopMode] = useState<TopMode>('revenue');

  // Toggle comparative mode
  const [isMergedView, setIsMergedView] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Unified data dictionary for all restaurants
  const [restaurantsData, setRestaurantsData] = useState<Record<string, {
    preAggDocs: PreAggDoc[];
    orders: Order[];
    expenses: Expense[];
    loadingPreAgg: boolean;
    loadingRaw: boolean;
  }>>({});

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
      setRangeError(null);
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

  // Load data reactively for all active tenant restaurants
  useEffect(() => {
    if (restaurants.length === 0) return;

    const unsubs: (() => void)[] = [];
    const createInitialRestaurantData = () => ({
      preAggDocs: [] as PreAggDoc[],
      orders: [] as Order[],
      expenses: [] as Expense[],
      loadingPreAgg: true,
      loadingRaw: true
    });

    restaurants.forEach(r => {
      // 1. Fetch pre-aggregated docs
      const unsubPreAgg = onSnapshot(
        collection(db, 'restaurants', r.id, 'reportDaily'),
        (snap) => {
          const docs = snap.docs.map((d) => ({ dateKey: d.id, ...d.data() } as PreAggDoc));
          setRestaurantsData(prev => {
            const current = prev[r.id] || createInitialRestaurantData();
            return {
              ...prev,
              [r.id]: {
                ...current,
                preAggDocs: docs,
                loadingPreAgg: false
              }
            };
          });
        },
        () => {
          setRestaurantsData(prev => {
            const current = prev[r.id] || createInitialRestaurantData();
            return {
              ...prev,
              [r.id]: {
                ...current,
                preAggDocs: [],
                loadingPreAgg: false
              }
            };
          });
        }
      );

      // 2. Fetch raw orders
      const unsubOrders = onSnapshot(collection(db, 'restaurants', r.id, 'orders'), (snap) => {
        const ordersList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
        setRestaurantsData(prev => {
          const current = prev[r.id] || createInitialRestaurantData();
          return {
            ...prev,
            [r.id]: {
              ...current,
              orders: ordersList,
              loadingRaw: false
            }
          };
        });
      }, () => {
        setRestaurantsData(prev => {
          const current = prev[r.id] || createInitialRestaurantData();
          return {
            ...prev,
            [r.id]: {
              ...current,
              orders: [],
              loadingRaw: false
            }
          };
        });
      });

      // 3. Fetch raw expenses
      const unsubExpenses = onSnapshot(collection(db, 'restaurants', r.id, 'expenses'), (snap) => {
        const expensesList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
        setRestaurantsData(prev => {
          const current = prev[r.id] || createInitialRestaurantData();
          return {
            ...prev,
            [r.id]: {
              ...current,
              expenses: expensesList
            }
          };
        });
      });

      unsubs.push(unsubPreAgg, unsubOrders, unsubExpenses);
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [restaurants]);

  // Determine model details dynamically
  const getModelForRestaurant = (rId: string) => {
    const rData = restaurantsData[rId];
    if (!rData || !rangeKeys) return null;

    const hasPreAgg = rData.preAggDocs.some((d) => d.dateKey >= rangeKeys.startKey && d.dateKey <= rangeKeys.endKey);

    if (hasPreAgg) {
      return {
        mode: 'preagg' as const,
        ...aggregateFromPreAggregatedData(rData.preAggDocs, rangeKeys.startKey, rangeKeys.endKey),
        rangeOrders: [] as Order[],
        rangeExpenses: [] as Expense[]
      };
    }
    return {
      mode: 'raw' as const,
      ...aggregateFromRawData(rData.orders, rData.expenses, rangeKeys.startKey, rangeKeys.endKey)
    };
  };

  // Loading calculation
  const loading = useMemo(() => {
    if (isMergedView) {
      return restaurants.length > 0 && restaurants.some(r => {
        const data = restaurantsData[r.id];
        return !data || data.loadingPreAgg || data.loadingRaw;
      });
    } else {
      if (!restaurantId) return true;
      const data = restaurantsData[restaurantId];
      return !data || data.loadingPreAgg || data.loadingRaw;
    }
  }, [isMergedView, restaurants, restaurantsData, restaurantId]);

  const periodLabel = useMemo(() => {
    if (!rangeKeys) return 'Invalid period';
    return `${dateFmt.format(new Date(`${rangeKeys.startKey}T00:00:00+05:30`))} - ${dateFmt.format(
      new Date(`${rangeKeys.endKey}T00:00:00+05:30`)
    )} (IST)`;
  }, [rangeKeys]);

  const activeRestaurant = useMemo(() => {
    return restaurants.find(r => r.id === restaurantId);
  }, [restaurants, restaurantId]);

  const activeModel = useMemo(() => {
    if (!restaurantId) return null;
    return getModelForRestaurant(restaurantId);
  }, [restaurantId, restaurantsData, rangeKeys]);

  const handleExportClick = () => {
    if (isMergedView && restaurants.length > 1) {
      setShowExportModal(true);
    } else {
      exportExcelSingle();
    }
  };

  const exportExcelSingle = async () => {
    if (!restaurantId) return;
    const model = getModelForRestaurant(restaurantId);
    if (!model || !rangeKeys) return;
    setExporting(true);
    try {
      let o = model.rangeOrders;
      let e = model.rangeExpenses;
      const rData = restaurantsData[restaurantId];
      if (model.mode === 'preagg' && rData) {
        o = rData.orders.filter((x) => {
          const k = toISTDateKey(x.createdAt);
          return k >= rangeKeys.startKey && k <= rangeKeys.endKey;
        });
        e = rData.expenses.filter((x) => {
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

      const items = [...model.topItems].sort((a, b) => b.revenue - a.revenue);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([['Item', 'Qty', 'Revenue'], ...items.map((x) => [x.name, x.quantity, x.revenue])]),
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

      XLSX.writeFile(wb, `restaurant_report_${activeRestaurant?.name || 'single'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const exportExcelComparative = async () => {
    if (!rangeKeys) return;
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // 1. Generate comparative master sheet
      const summaryRows = [
        ['Comparative Financial Dashboard'],
        ['Period', periodLabel],
        ['Generated on', new Date().toLocaleDateString()],
        [],
        ['KPI Parameter', ...restaurants.map(r => r.name), 'Combined Total']
      ];

      // Calculate models
      const models = restaurants.map(r => ({
        restaurant: r,
        model: getModelForRestaurant(r.id)
      }));

      const getVal = (param: string) => {
        const vals = models.map(m => {
          if (!m.model) return 0;
          const kpis = m.model.kpis;
          switch (param) {
            case 'realized': return kpis.realizedRevenue;
            case 'operational': return kpis.operationalRevenue;
            case 'profit': return kpis.netProfit;
            case 'orders': return kpis.ordersCount;
            case 'expenses': return kpis.totalExpenses;
            case 'discount': return kpis.totalDiscounts;
            case 'tax': return kpis.taxCollected;
            default: return 0;
          }
        });
        const total = vals.reduce((sum, v) => sum + v, 0);
        return [...vals, total];
      };

      summaryRows.push(
        ['Realized Revenue (Completed & Paid)', ...getVal('realized')] as any[],
        ['Operational Revenue (Non-cancelled)', ...getVal('operational')] as any[],
        ['Net Profit / Loss', ...getVal('profit')] as any[],
        ['Total Orders Completed', ...getVal('orders')] as any[],
        ['Total Operational Expenses', ...getVal('expenses')] as any[],
        ['Total Discounts Given', ...getVal('discount')] as any[],
        ['Total Tax Collected', ...getVal('tax')] as any[]
      );

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Comparative Overview');

      // 2. Add detailed sheets for each restaurant
      for (const { restaurant, model } of models) {
        if (!model) continue;

        const prefix = restaurant.name.slice(0, 12); // Keep sheet name prefix short (max 12 chars)

        // Executive Summary
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([
            [`${restaurant.name} - Executive Summary`],
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
          `${prefix} Summary`
        );

        // Daily Summary
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
          `${prefix} Daily`
        );

        // Item Performance
        const items = [...model.topItems].sort((a, b) => b.revenue - a.revenue);
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([['Item', 'Qty', 'Revenue'], ...items.map((x) => [x.name, x.quantity, x.revenue])]),
          `${prefix} Items`
        );
      }

      XLSX.writeFile(wb, `restaurants_comparison_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Comparative Excel report downloaded successfully");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate comparative sheet: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const openDrilldown = async (row: DailyReportRow, rId: string) => {
    const rData = restaurantsData[rId];
    if (!rData) return;

    let localOrders = rData.orders;
    let localExpenses = rData.expenses;
    const model = getModelForRestaurant(rId);

    if (model?.mode === 'preagg') {
      const [oSnap, eSnap] = await Promise.all([
        getDocs(collection(db, 'restaurants', rId, 'orders')),
        getDocs(collection(db, 'restaurants', rId, 'expenses'))
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

  // Helper to compile comparative values for KPI cards
  const getComparativeKPI = (param: string) => {
    return restaurants.map(r => {
      const model = getModelForRestaurant(r.id);
      let val = 0;
      let suffix = '';
      if (model) {
        const kpis = model.kpis;
        switch (param) {
          case 'realized': 
            val = kpis.realizedRevenue;
            break;
          case 'profit': 
            val = kpis.netProfit;
            suffix = `Ratio ${kpis.expenseRatio.toFixed(1)}%`;
            break;
          case 'orders': 
            val = kpis.ordersCount;
            suffix = `AOV ₹${kpis.aov.toFixed(0)}`;
            break;
          case 'operational': 
            val = kpis.operationalRevenue;
            break;
          case 'discounts': 
            val = kpis.totalDiscounts;
            break;
          case 'tax': 
            val = kpis.taxCollected;
            break;
          case 'delivery': 
            val = kpis.deliveryCharges;
            break;
          case 'expenses': 
            val = kpis.totalExpenses;
            break;
        }
      }
      return {
        name: r.name,
        value: param === 'orders' ? `${val}` : money.format(val),
        sub: suffix || undefined
      };
    });
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

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-gray-150 pb-5 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pro Financial Reports</h2>
          <p className="text-sm text-gray-500">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Merge Comparison Button */}
          {restaurants.length > 1 && (
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-sm">
              <span className="font-bold text-gray-600">Compare Restaurants</span>
              <button
                onClick={() => setIsMergedView(!isMergedView)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isMergedView ? 'bg-orange-600' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isMergedView ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )}

          {/* Timeframe selector */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm text-sm">
            {[
              ['today', 'Today'],
              ['last7', '7 Days'],
              ['thisMonth', 'This Month'],
              ['custom', 'Custom']
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  const next = k as RangeType;
                  if (next === 'custom') {
                    const today = toISTDateKey(new Date());
                    const defaultStart = `${today.slice(0, 8)}01`;
                    setCustomStart((prev) => prev || defaultStart);
                    setCustomEnd((prev) => prev || today);
                  }
                  setRange(next);
                }}
                className={`px-3 py-2 ${range === k ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input className="border rounded px-2 py-1 text-sm bg-white outline-none" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-gray-400 text-xs">to</span>
              <input className="border rounded px-2 py-1 text-sm bg-white outline-none" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}

          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg border text-sm bg-gray-100 hover:bg-gray-200 flex items-center font-medium shadow-sm cursor-pointer">
            <Printer className="h-4 w-4 mr-2 text-gray-500" /> Print
          </button>
          <button
            onClick={handleExportClick}
            disabled={exporting}
            className="px-4 py-2 rounded-lg text-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center font-medium disabled:opacity-70 shadow-sm cursor-pointer"
          >
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Excel Export
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card 
          title="Realized Revenue" 
          value={!isMergedView && activeModel ? money.format(activeModel.kpis.realizedRevenue) : undefined} 
          sub={!isMergedView ? "Completed + Paid" : undefined}
          comparison={isMergedView ? getComparativeKPI('realized') : undefined}
        />
        <Card 
          title="Net Profit" 
          value={!isMergedView && activeModel ? money.format(activeModel.kpis.netProfit) : undefined} 
          sub={!isMergedView && activeModel ? `Expense ratio ${activeModel.kpis.expenseRatio.toFixed(2)}%` : undefined}
          comparison={isMergedView ? getComparativeKPI('profit') : undefined}
        />
        <Card 
          title="Orders" 
          value={!isMergedView && activeModel ? `${activeModel.kpis.ordersCount}` : undefined} 
          sub={!isMergedView && activeModel ? `AOV ${money.format(activeModel.kpis.aov)}` : undefined}
          comparison={isMergedView ? getComparativeKPI('orders') : undefined}
        />
        <Card 
          title="Operational Revenue" 
          value={!isMergedView && activeModel ? money.format(activeModel.kpis.operationalRevenue) : undefined} 
          sub={!isMergedView ? "Non-cancelled orders" : undefined}
          comparison={isMergedView ? getComparativeKPI('operational') : undefined}
        />
        <Card 
          title="Discounts" 
          value={!isMergedView && activeModel ? money.format(activeModel.kpis.totalDiscounts) : undefined} 
          comparison={isMergedView ? getComparativeKPI('discounts') : undefined}
        />
        <Card 
          title="Tax Collected" 
          value={!isMergedView && activeModel ? money.format(activeModel.kpis.taxCollected) : undefined} 
          comparison={isMergedView ? getComparativeKPI('tax') : undefined}
        />
        <Card 
          title="Delivery Charges" 
          value={!isMergedView && activeModel ? money.format(activeModel.kpis.deliveryCharges) : undefined} 
          comparison={isMergedView ? getComparativeKPI('delivery') : undefined}
        />
        <Card 
          title="Expenses" 
          value={!isMergedView && activeModel ? money.format(activeModel.kpis.totalExpenses) : undefined} 
          comparison={isMergedView ? getComparativeKPI('expenses') : undefined}
        />
      </div>

      {/* Main Reports Visual Sections */}
      {isMergedView ? (
        <div className="space-y-8 print:hidden">
          {/* 1. Daily Trend Charts Side-by-Side */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-black text-sm text-gray-800 border-b border-gray-100 pb-2">Daily Trend Comparison (Sales/Expenses/Profit)</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {restaurants.map(r => {
                const model = getModelForRestaurant(r.id);
                if (!model) return null;
                const trend = model.dailyRows.map((d: any) => ({
                  ...d,
                  day: dayFmt.format(new Date(`${d.dateKey}T00:00:00+05:30`))
                }));
                return (
                  <div key={r.id} className="space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">{r.name}</p>
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
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Payment Method Breakdown Charts */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-black text-sm text-gray-800 border-b border-gray-100 pb-2">Payment Method Comparison</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {restaurants.map(r => {
                const model = getModelForRestaurant(r.id);
                if (!model) return null;
                return (
                  <div key={r.id} className="space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">{r.name}</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={model.paymentBreakdown} dataKey="value" nameKey="key" outerRadius={90}>
                          {model.paymentBreakdown.map((_: any, i: number) => (
                            <Cell key={i} fill={['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'][i % 4]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => money.format(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Order Type Revenue Split */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-black text-sm text-gray-800 border-b border-gray-100 pb-2">Order Type Split Comparison</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {restaurants.map(r => {
                const model = getModelForRestaurant(r.id);
                if (!model) return null;
                return (
                  <div key={r.id} className="space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">{r.name}</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={model.orderTypeBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="key" />
                        <YAxis />
                        <Tooltip formatter={(v: number) => money.format(v)} />
                        <Bar dataKey="value" fill="#ea580c" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Order Status Distribution */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-black text-sm text-gray-800 border-b border-gray-100 pb-2">Order Status Distribution Comparison</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {restaurants.map(r => {
                const model = getModelForRestaurant(r.id);
                if (!model) return null;
                return (
                  <div key={r.id} className="space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">{r.name}</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={model.statusBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="key" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Top Performing Items Side-by-Side */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h3 className="font-black text-sm text-gray-800">Top Performing Items Comparison</h3>
              <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden text-xs font-semibold bg-gray-50 shadow-sm">
                <button onClick={() => setTopMode('revenue')} className={`px-3 py-1.5 cursor-pointer ${topMode === 'revenue' ? 'bg-white text-orange-700 shadow-sm font-bold' : 'text-gray-500'}`}>
                  By Revenue
                </button>
                <button onClick={() => setTopMode('quantity')} className={`px-3 py-1.5 cursor-pointer ${topMode === 'quantity' ? 'bg-white text-orange-700 shadow-sm font-bold' : 'text-gray-500'}`}>
                  By Quantity
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {restaurants.map(r => {
                const model = getModelForRestaurant(r.id);
                if (!model) return null;
                const sortedTopItems = [...model.topItems].sort((a, b) => 
                  topMode === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity
                );
                return (
                  <div key={r.id} className="space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">{r.name}</p>
                    <table className="min-w-full text-sm">
                      <thead className="text-gray-400 border-b border-gray-100 font-bold uppercase tracking-wider text-xs">
                        <tr>
                          <th className="py-2 text-left">Item Name</th>
                          <th className="py-2 text-right">Qty</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sortedTopItems.slice(0, 10).map((i) => (
                          <tr key={i.id} className="hover:bg-gray-50">
                            <td className="py-2.5 font-medium text-gray-800">{i.name}</td>
                            <td className="py-2.5 text-right font-semibold text-gray-600">{i.quantity}</td>
                            <td className="py-2.5 text-right font-bold text-gray-900">{money.format(i.revenue)}</td>
                          </tr>
                        ))}
                        {sortedTopItems.length === 0 && (
                          <tr><td colSpan={3} className="py-4 text-center text-gray-400">No items sold.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Daily P&L Summary Comparison */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-black text-sm text-gray-800 border-b border-gray-100 pb-2">Daily P&L Comparison (Click row to drilldown)</h3>
            <div className="grid grid-cols-1 gap-8">
              {restaurants.map(r => {
                const model = getModelForRestaurant(r.id);
                if (!model) return null;
                return (
                  <div key={r.id} className="space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">{r.name}</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="text-gray-400 border-b border-gray-100 font-bold uppercase tracking-wider">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Date</th>
                            <th className="px-2 py-1.5 text-right">Orders</th>
                            <th className="px-2 py-1.5 text-right">Gross Sales</th>
                            <th className="px-2 py-1.5 text-right">Discounts</th>
                            <th className="px-2 py-1.5 text-right">Tax</th>
                            <th className="px-2 py-1.5 text-right">Net Sales</th>
                            <th className="px-2 py-1.5 text-right">Expenses</th>
                            <th className="px-2 py-1.5 text-right">Profit</th>
                            <th className="px-2 py-1.5 text-right">AOV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.dailyRows.map((d: any) => (
                            <tr key={d.dateKey} onClick={() => openDrilldown(d, r.id)} className="border-b border-gray-50 hover:bg-orange-50 cursor-pointer transition-colors duration-150">
                              <td className="px-2 py-2 font-semibold text-gray-700">{dateFmt.format(new Date(`${d.dateKey}T00:00:00+05:30`))}</td>
                              <td className="px-2 py-2 text-right font-medium text-gray-600">{d.ordersCount}</td>
                              <td className="px-2 py-2 text-right font-medium text-gray-800">{money.format(d.grossSales)}</td>
                              <td className="px-2 py-2 text-right font-semibold text-red-500">-{money.format(d.discounts)}</td>
                              <td className="px-2 py-2 text-right font-medium text-gray-600">{money.format(d.taxTotal)}</td>
                              <td className="px-2 py-2 text-right font-bold text-gray-900">{money.format(d.netSales)}</td>
                              <td className="px-2 py-2 text-right font-semibold text-red-500">{money.format(d.expenses)}</td>
                              <td className={`px-2 py-2 text-right font-black ${d.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money.format(d.netProfit)}</td>
                              <td className="px-2 py-2 text-right font-semibold text-gray-700">{money.format(d.aov)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        activeRestaurant && activeModel && (
          <RestaurantReportDetails rId={activeRestaurant.id} name={activeRestaurant.name} model={activeModel} topMode={topMode} setTopMode={setTopMode} openDrilldown={openDrilldown} />
        )
      )}

      {/* Day Drilldown Overlay */}
      {drilldown && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="px-5 py-3 bg-gray-50 border-b flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold text-gray-800">Day Drilldown: {dateFmt.format(new Date(`${drilldown.dateKey}T00:00:00+05:30`))}</h3>
              <button onClick={() => setDrilldown(null)} className="hover:bg-gray-100 p-1 rounded-lg cursor-pointer"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
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
                      <li key={p.key} className="flex justify-between border-b border-gray-50 pb-1">
                        <span className="text-gray-600 font-medium">{p.key}</span>
                        <span className="font-bold text-gray-800">{money.format(p.value)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Top Items (Day)">
                  <ul className="space-y-2 text-sm font-sans">
                    {drilldown.topItems.length === 0 && <li className="text-gray-500">No item sales on this day.</li>}
                    {drilldown.topItems.slice(0, 8).map((i) => (
                      <li key={i.id} className="flex justify-between border-b border-gray-50 pb-1">
                        <span className="text-gray-600 font-medium">{i.name}</span>
                        <span className="font-bold text-gray-800">
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

      {/* Export Preference Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="text-center mb-6">
              <div className="bg-orange-50 p-3 rounded-full text-orange-600 w-fit mx-auto mb-3">
                <Download className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Export Reports to Excel</h3>
              <p className="text-sm text-gray-500 mt-1">Select the format of the reports workbook you wish to download.</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setShowExportModal(false);
                  exportExcelSingle();
                }}
                className="w-full flex items-center justify-between p-4 border border-gray-200 hover:border-orange-500 hover:bg-orange-50 rounded-xl transition text-left cursor-pointer group"
              >
                <div>
                  <span className="font-bold text-gray-800 group-hover:text-orange-700 block text-sm">Active Restaurant Only</span>
                  <span className="text-xs text-gray-400">Download Excel report for {activeRestaurant?.name || 'current restaurant'} only.</span>
                </div>
                <ChevronDown className="h-5 w-5 text-gray-400 -rotate-90" />
              </button>
              
              {restaurants.length > 1 && (
                <button 
                  onClick={() => {
                    setShowExportModal(false);
                    exportExcelComparative();
                  }}
                  className="w-full flex items-center justify-between p-4 border border-gray-200 hover:border-orange-500 hover:bg-orange-50 rounded-xl transition text-left cursor-pointer group"
                >
                  <div>
                    <span className="font-bold text-gray-800 group-hover:text-orange-700 block text-sm">Comparative Multi-Sheet Workbook</span>
                    <span className="text-xs text-gray-400">Compare both restaurants side-by-side in a master Excel workbook.</span>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-400 -rotate-90" />
                </button>
              )}
            </div>
            <button 
              onClick={() => setShowExportModal(false)}
              className="w-full mt-4 py-2.5 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component to render all details for a single restaurant
const RestaurantReportDetails: React.FC<{
  rId: string;
  name: string;
  model: any;
  topMode: TopMode;
  setTopMode: (mode: TopMode) => void;
  openDrilldown: (row: DailyReportRow, rId: string) => void;
}> = ({ rId, name, model, topMode, setTopMode, openDrilldown }) => {
  const trend = model.dailyRows.map((d: any) => ({
    ...d,
    day: dayFmt.format(new Date(`${d.dateKey}T00:00:00+05:30`))
  }));

  const sortedTopItems = useMemo(() => {
    const list = [...model.topItems];
    return topMode === 'revenue' ? list.sort((a, b) => b.revenue - a.revenue) : list.sort((a, b) => b.quantity - a.quantity);
  }, [model, topMode]);

  return (
    <div className="space-y-6">
      {/* Charts Panel Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:hidden">
        <Panel title={`${name} - Daily Trend (Sales/Expenses/Profit)`}>
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

        <Panel title={`${name} - Payment Method Breakdown`}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={model.paymentBreakdown} dataKey="value" nameKey="key" outerRadius={90}>
                {model.paymentBreakdown.map((_: any, i: number) => (
                  <Cell key={i} fill={['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'][i % 4]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => money.format(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={`${name} - Order Type Revenue Split`}>
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

        <Panel title={`${name} - Order Status Distribution`}>
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

      {/* Top Items List */}
      <Panel title={`${name} - Top Performing Items`}>
        <div className="flex justify-end mb-3">
          <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden text-xs font-semibold bg-gray-50 shadow-sm">
            <button onClick={() => setTopMode('revenue')} className={`px-3 py-1.5 cursor-pointer ${topMode === 'revenue' ? 'bg-white text-orange-700 shadow-sm font-bold' : 'text-gray-500'}`}>
              By Revenue
            </button>
            <button onClick={() => setTopMode('quantity')} className={`px-3 py-1.5 cursor-pointer ${topMode === 'quantity' ? 'bg-white text-orange-700 shadow-sm font-bold' : 'text-gray-500'}`}>
              By Quantity
            </button>
          </div>
        </div>
        <table className="min-w-full text-sm">
          <thead className="text-gray-400 border-b border-gray-100 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th className="py-2 text-left">Item Name</th>
              <th className="py-2 text-right">Quantity Sold</th>
              <th className="py-2 text-right">Total Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedTopItems.slice(0, 10).map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-800">{i.name}</td>
                <td className="py-3 text-right font-semibold text-gray-600">{i.quantity}</td>
                <td className="py-3 text-right font-bold text-gray-900">{money.format(i.revenue)}</td>
              </tr>
            ))}
            {sortedTopItems.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-gray-400">No items sold.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>

      {/* P&L Daily Summary Table */}
      <Panel title={`${name} - Daily P&L Summary (Click row to drilldown)`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-gray-400 border-b border-gray-100 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Gross Sales</th>
                <th className="px-3 py-2 text-right">Discounts</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Net Sales</th>
                <th className="px-3 py-2 text-right">Expenses</th>
                <th className="px-3 py-2 text-right">Profit</th>
                <th className="px-3 py-2 text-right">AOV</th>
              </tr>
            </thead>
            <tbody>
              {model.dailyRows.map((d: any) => (
                <tr key={d.dateKey} onClick={() => openDrilldown(d, rId)} className="border-b border-gray-50 hover:bg-orange-50 cursor-pointer transition-colors duration-150">
                  <td className="px-3 py-3 font-semibold text-gray-700">{dateFmt.format(new Date(`${d.dateKey}T00:00:00+05:30`))}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-600">{d.ordersCount}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">{money.format(d.grossSales)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-red-500">-{money.format(d.discounts)}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-600">{money.format(d.taxTotal)}</td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900">{money.format(d.netSales)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-red-500">{money.format(d.expenses)}</td>
                  <td className={`px-3 py-3 text-right font-black ${d.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money.format(d.netProfit)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-700">{money.format(d.aov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

const Card: React.FC<{ 
  title: string; 
  value?: string; 
  sub?: string; 
  comparison?: { name: string; value: string; sub?: string }[] 
}> = ({ title, value, sub, comparison }) => (
  <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
    {comparison ? (
      <div className="space-y-2 mt-1 font-sans">
        {comparison.map((c, idx) => (
          <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
            <span className="font-semibold text-gray-500 max-w-[120px] truncate">{c.name}</span>
            <div className="text-right">
              <span className="font-bold text-gray-900">{c.value}</span>
              {c.sub && <span className="text-[10px] text-gray-400 block font-normal">{c.sub}</span>}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <>
        <h3 className="text-2xl font-black text-gray-900 mt-1">{value}</h3>
        {sub && <p className="text-[10px] text-gray-400 mt-2 block">{sub}</p>}
      </>
    )}
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
    <h3 className="font-black text-sm text-gray-800 mb-4">{title}</h3>
    {children}
  </div>
);

export default Reports;
