import React, { useState, useEffect } from 'react';
import { fetchTopPages } from '../data/dataService';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  ArrowDownRight, 
  Activity,
  History,
  Eye,
  MousePointer2
} from 'lucide-react';

interface DropOffAnalysisProps {
  days: number;
}

const DropOffAnalysis: React.FC<DropOffAnalysisProps> = ({ days }) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchTopPages(days);
        setPages(data);
      } catch (error) {
        console.error("Error loading drop-off data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Top drop-off pages (high bounce rate, > 50 views, top 12)
  const dropOffPages = pages
    .filter(p => p.screen_page_views > 50)
    .sort((a, b) => (b.bounce_rate) - (a.bounce_rate))
    .slice(0, 12);

  // Problem zones (> 50% bounce + high traffic)
  const problemZones = pages
    .filter(p => (p.bounce_rate * 100) > 50)
    .sort((a, b) => b.screen_page_views - a.screen_page_views)
    .slice(0, 5);

  // Retention pages (< 20% bounce + high engagement)
  const retentionPages = pages
    .filter(p => (p.bounce_rate * 100) < 20)
    .sort((a, b) => b.avg_engagement_time - a.avg_engagement_time)
    .slice(0, 5);

  const getBounceColor = (br: number) => {
    const p = br * 100;
    if (p < 30) return 'text-success bg-success/10';
    if (p < 60) return 'text-warning bg-warning/10';
    return 'text-danger bg-danger/10';
  };

  const getBounceBarColor = (br: number) => {
    const p = br * 100;
    if (p < 40) return 'bg-success/50';
    if (p < 60) return 'bg-warning/50';
    if (p < 80) return 'bg-danger/50';
    return 'bg-danger';
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-danger/80">АНАЛИЗ ОКАЗОВ И ПОТЕРЬ</h2>
        <p className="text-primary/50 text-sm">Где клиенты уходят с сайта и почему</p>
      </div>

      <section className="card p-6 border-t-4 border-danger">
        <div className="flex items-center gap-2 mb-6">
          <ArrowDownRight className="text-danger" />
          <h3 className="text-xl font-bold uppercase tracking-tight">Страницы с максимальным Bounce Rate</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {dropOffPages.map((page, idx) => (
            <div key={page.page_path} className="space-y-1.5 group">
              <div className="flex justify-between items-end">
                <div className="pr-4 max-w-[70%]">
                  <div className="text-xs font-bold truncate" title={page.page_title}>
                    {idx + 1}. {page.page_title}
                  </div>
                  <a href={"https://05.ru" + page.page_path} target="_blank" rel="noopener noreferrer" className="text-[9px] text-slate-500 font-mono truncate block hover:text-primary transition-colors" title={page.page_path}>{page.page_path}</a>
                </div>
                <div className="text-sm font-black text-danger flex-shrink-0">{(page.bounce_rate * 100).toFixed(1)}%</div>
              </div>
              <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${getBounceBarColor(page.bounce_rate)}`}
                  style={{ width: `${page.bounce_rate * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-primary/40 font-mono">
                <span className="flex items-center"><Eye size={10} className="mr-1" />{page.screen_page_views.toLocaleString('ru-RU')} views</span>
                <span className="flex items-center"><History size={10} className="mr-1" />{page.avg_engagement_time.toFixed(1)}s eng.</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PROBLEM ZONES */}
        <section className="card p-0 overflow-hidden border-danger/20">
          <div className="bg-danger/10 p-5 border-b border-danger/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-danger" size={20} />
              <h3 className="font-black uppercase tracking-widest text-danger/90">Проблемные зоны</h3>
            </div>
            <span className="text-[10px] font-bold bg-danger text-white px-2 py-0.5 rounded uppercase">Critical</span>
          </div>
          <div className="p-4 space-y-4">
            {problemZones.map((page) => (
              <div key={page.page_path} className="flex gap-4 items-start p-3 rounded-lg hover:bg-danger/5 transition-colors border border-transparent hover:border-danger/10">
                <div className="w-12 h-12 rounded bg-surface flex items-center justify-center shrink-0 border border-primary/5">
                  <Activity size={24} className="text-danger/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" title={page.page_title}>{page.page_title}</div>
                  <a href={"https://05.ru" + page.page_path} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/40 font-mono truncate mb-2 block hover:text-primary transition-colors">{page.page_path}</a>
                  <div className="flex gap-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-primary/30 uppercase font-bold">Отказы</span>
                      <span className="text-xs font-black text-danger">{(page.bounce_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col border-l border-primary/10 pl-4">
                      <span className="text-[9px] text-primary/30 uppercase font-bold">Трафик</span>
                      <span className="text-xs font-black">{page.screen_page_views.toLocaleString('ru-RU')}</span>
                    </div>
                    <div className="flex flex-col border-l border-primary/10 pl-4">
                      <span className="text-[9px] text-primary/30 uppercase font-bold">Удержание</span>
                      <span className="text-xs font-black">{page.avg_engagement_time.toFixed(0)}с</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RETENTION PAGES */}
        <section className="card p-0 overflow-hidden border-success/20">
          <div className="bg-success/10 p-5 border-b border-success/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-success" size={20} />
              <h3 className="font-black uppercase tracking-widest text-success/90">Удерживающие страницы</h3>
            </div>
            <span className="text-[10px] font-bold bg-success text-white px-2 py-0.5 rounded uppercase">Best</span>
          </div>
          <div className="p-4 space-y-4">
            {retentionPages.map((page) => (
              <div key={page.page_path} className="flex gap-4 items-start p-3 rounded-lg hover:bg-success/5 transition-colors border border-transparent hover:border-success/10">
                <div className="w-12 h-12 rounded bg-surface flex items-center justify-center shrink-0 border border-primary/5">
                  <MousePointer2 size={24} className="text-success/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" title={page.page_title}>{page.page_title}</div>
                  <a href={"https://05.ru" + page.page_path} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/40 font-mono truncate mb-2 block hover:text-primary transition-colors">{page.page_path}</a>
                  <div className="flex gap-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-primary/30 uppercase font-bold">Отказы</span>
                      <span className="text-xs font-black text-success">{(page.bounce_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col border-l border-primary/10 pl-4">
                      <span className="text-[9px] text-primary/30 uppercase font-bold">Трафик</span>
                      <span className="text-xs font-black">{page.screen_page_views.toLocaleString('ru-RU')}</span>
                    </div>
                    <div className="flex flex-col border-l border-primary/10 pl-4">
                      <span className="text-[9px] text-primary/30 uppercase font-bold">Удержание</span>
                      <span className="text-xs font-black">{page.avg_engagement_time.toFixed(0)}с</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DropOffAnalysis;
