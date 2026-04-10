import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchTrafficSources } from '../data/dataService';
import { BarChart as RechartsBarChart, Bar as RechartsBar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

interface TrafficSourceAnalysisProps {
  days: number;
}

const TrafficSourceAnalysis: React.FC<TrafficSourceAnalysisProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [sourceData, setSourceData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchTrafficSources(days);
        const mappedData = data.map((d: any) => ({
            ...d,
            cr: d.sessions > 0 ? (d.conversions / d.sessions) * 100 : 0
        })).sort((a: any, b: any) => b.sessions - a.sessions);
        setSourceData(mappedData);
      } catch (error) {
        console.error('Failed to fetch traffic source data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-slate-400 font-medium italic">Загрузка данных источников трафика...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold mb-8 text-white">Эффективность каналов трафика</h3>
          <RechartsResponsiveContainer width="100%" height={400}>
            <RechartsBarChart 
                data={sourceData.slice(0, 10)} 
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
            >
                <RechartsCartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                <RechartsXAxis type="number" stroke="#94a3b8" />
                <RechartsYAxis dataKey="name" type="category" stroke="#94a3b8" width={150} tickLine={false} axisLine={false} style={{ fontSize: '11px' }} />
                <RechartsTooltip 
                    cursor={{ fill: '#1e293b' }}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                                <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-2xl">
                                    <p className="font-bold text-slate-200 mb-2">{d.name}</p>
                                    <div className="space-y-1">
                                        <p className="flex justify-between gap-4"><span className="text-slate-500 text-sm">Сессии:</span> <span className="text-primary font-bold">{d.sessions.toLocaleString('ru-RU')}</span></p>
                                        <p className="flex justify-between gap-4"><span className="text-slate-500 text-sm">Конверсия:</span> <span className="text-success font-bold font-mono">{d.cr.toFixed(2)}%</span></p>
                                        <div className="h-0.5 w-full bg-slate-800 rounded-full my-2"></div>
                                        <p className="flex justify-between gap-4"><span className="text-slate-500 text-sm">Доход:</span> <span className="text-warning font-bold">{d.revenue.toLocaleString('ru-RU')} ₽</span></p>
                                        <p className="flex justify-between gap-4"><span className="text-slate-500 text-sm">Транзакции:</span> <span className="text-white font-bold">{d.conversions.toLocaleString('ru-RU')}</span></p>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    }}
                 />
                <RechartsBar dataKey="sessions" name="Сессии" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </RechartsBarChart>
          </RechartsResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sourceData.slice(0, 4).map((source, i) => (
              <div key={i} className="card p-6 flex flex-col justify-between border-t-4 border-t-primary shadow-xl bg-surface border-slate-700/50">
                  <div className="mb-4">
                    <h5 className="font-bold text-slate-300 mb-4 truncate text-sm uppercase tracking-wider">{source.name}</h5>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Сессии</p>
                            <p className="text-lg font-bold text-white">{source.sessions.toLocaleString('ru-RU')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">CR %</p>
                            <p className="text-lg font-bold text-success">{source.cr.toFixed(2)}%</p>
                        </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center bg-slate-800/20 p-2 rounded-lg">
                       <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest pr-2">Доход:</span>
                       <span className="text-sm font-bold text-warning">{source.revenue.toLocaleString('ru-RU')} ₽</span>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default TrafficSourceAnalysis;
