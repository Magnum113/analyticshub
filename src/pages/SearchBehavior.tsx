import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchSearchTerms } from '../data/dataService';
import { BarChart as RechartsBarChart, Bar as RechartsBar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

interface SearchBehaviorProps {
  days: number;
}

const SearchBehavior: React.FC<SearchBehaviorProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [searchData, setSearchData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchSearchTerms(days);
        // data aggregated by search_term: { search_term, search_count, unique_users }
        setSearchData(data);
      } catch (error) {
        console.error('Failed to fetch search terms data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  const totalSearches = useMemo(() => searchData.reduce((sum, d) => sum + d.search_count, 0), [searchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-400 font-medium">Анализ поисковых запросов...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-8 bg-surface border border-slate-700/50 shadow-2xl">
          <h3 className="text-xl font-bold mb-8 text-white uppercase tracking-widest">Самые частотные поисковые запросы</h3>
          <RechartsResponsiveContainer width="100%" height={400}>
            <RechartsBarChart data={searchData.slice(0, 15)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <RechartsXAxis dataKey="search_term" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                <RechartsYAxis stroke="#94a3b8" />
                <RechartsTooltip 
                    cursor={{ fill: '#1e293b' }}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                             const d = payload[0].payload;
                             return (
                                 <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-2xl">
                                     <p className="font-bold text-slate-200 mb-2 uppercase tracking-widest text-xs">{d.search_term}</p>
                                     <div className="space-y-2">
                                         <p className="flex justify-between gap-6 text-sm"><span className="text-slate-500">Запросов:</span> <span className="text-white font-bold">{d.search_count.toLocaleString('ru-RU')}</span></p>
                                         <p className="flex justify-between gap-6 text-sm"><span className="text-slate-500">Пользователей:</span> <span className="text-primary font-bold">{d.unique_users.toLocaleString('ru-RU')}</span></p>
                                     </div>
                                 </div>
                             );
                        }
                        return null;
                    }}
                />
                <RechartsBar dataKey="search_count" name="Кол-во запросов" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          </RechartsResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {searchData.slice(0, 6).map((term, i) => (
              <div key={i} className="card p-6 flex flex-col justify-between hover:bg-slate-800 transition-colors bg-surface border border-slate-700/50 shadow-xl group">
                  <div>
                    <h5 className="font-bold text-white mb-2 uppercase text-sm tracking-widest group-hover:text-primary transition-colors">{term.search_term}</h5>
                    <div className="mt-4 flex items-center justify-between">
                         <div className="space-y-1">
                             <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Всего запросов</p>
                             <p className="text-2xl font-bold text-white">{term.search_count.toLocaleString('ru-RU')}</p>
                         </div>
                         <div className="h-10 w-10 flex items-center justify-center bg-slate-800 rounded-full border border-slate-700">
                            <span className="text-xs font-bold text-slate-400">#{i+1}</span>
                         </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-700/50">
                       <div className="flex justify-between text-xs mb-1 font-bold text-slate-500 uppercase tracking-tighter">
                          <span>Доля запросов</span>
                          <span>{(totalSearches > 0 ? (term.search_count / totalSearches) * 100 : 0).toFixed(1)}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                           <div
                             className="h-full bg-primary/60 rounded-full"
                             style={{ width: `${totalSearches > 0 ? (term.search_count / totalSearches) * 100 : 0}%` }}
                           ></div>
                       </div>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default SearchBehavior;
