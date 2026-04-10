import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from 'recharts';
import { Loader2 } from 'lucide-react';
import { fetchDeviceData } from '../data/dataService';

interface DeviceComparisonProps {
  days: number;
}

const DeviceComparison: React.FC<DeviceComparisonProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [deviceData, setDeviceData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchDeviceData(days);
        setDeviceData(data);
      } catch (error) {
        console.error('Failed to fetch device data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-400 font-medium">Загрузка данных по устройствам...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
              <h3 className="text-xl font-bold mb-8 text-white">Распределение по устройствам</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={deviceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="sessions"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                        {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip />
                </PieChart>
              </ResponsiveContainer>
          </div>

          <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
              <h3 className="text-xl font-bold mb-8 text-white">Конверсия по устройствам (%)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deviceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                        cursor={{ fill: '#1e293b' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-2xl">
                                        <p className="font-bold text-slate-200 mb-2">{d.name}</p>
                                        <div className="space-y-1">
                                            <p className="flex justify-between gap-4"><span className="text-slate-500">Добавление в корзину:</span> <span className="text-primary font-bold">{d.cartRate.toFixed(1)}%</span></p>
                                            <p className="flex justify-between gap-4"><span className="text-slate-500">Покупка:</span> <span className="text-success font-bold font-mono">{d.conversion.toFixed(1)}%</span></p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="cartRate" name="В корзину" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="conversion" name="Покупка" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Legend iconType="circle" />
                </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold mb-8 text-white">Сравнение воронки: Мобильные vs Десктоп</h3>
          <div className="space-y-8">
             {deviceData.filter(d => ['Мобильные', 'Десктоп'].includes(d.name)).map((device, i) => (
                 <div key={i} className="space-y-3">
                     <div className="flex justify-between items-baseline mb-2">
                         <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${device.name === 'Десктоп' ? 'bg-success' : 'bg-primary'}`}></span>
                            <span className="font-bold uppercase tracking-wider text-xs text-slate-400">{device.name}</span>
                         </div>
                         <span className="text-slate-500 text-xs">Конверсия: <span className="text-white font-bold">{device.conversion.toFixed(2)}%</span></span>
                     </div>
                     <div className="relative h-10 w-full bg-slate-800 rounded-lg overflow-hidden flex shadow-inner border border-slate-700/50">
                        <div className="h-full bg-primary/40 flex items-center px-4 text-[11px] font-bold text-white border-r border-slate-900 transition-all truncate" style={{ width: '100%' }}>СЕССИИ ({device.sessions.toLocaleString()})</div>
                        <div className="h-full bg-primary/60 flex items-center px-4 text-[11px] font-bold text-white border-r border-slate-900 transition-all truncate" style={{ width: `${Math.max(20, device.cartRate * 4)}%`, minWidth: '40px' }}>КОРЗИНА ({device.add_to_carts.toLocaleString()})</div>
                        <div className="h-full bg-success/60 flex items-center px-4 text-[11px] font-bold text-white transition-all truncate" style={{ width: `${Math.max(10, device.conversion * 15)}%`, minWidth: '15px' }}>КУПИЛИ ({device.conversions.toLocaleString()})</div>
                     </div>
                 </div>
             ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-8 italic uppercase tracking-widest font-bold">* Данные из Яндекс.Метрики + CRM 05.ru</p>
      </div>
    </div>
  );
};

export default DeviceComparison;
