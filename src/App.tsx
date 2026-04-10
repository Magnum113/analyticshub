import React, { useState } from 'react';
import { LayoutDashboard, Filter, ArrowRightLeft, Users, Percent, Search, Menu, X, Calendar } from 'lucide-react';
import FunnelChart from './pages/FunnelChart';
import UserPathExplorer from './pages/UserPathExplorer';
import DropOffAnalysis from './pages/DropOffAnalysis';
import DeviceComparison from './pages/DeviceComparison';
import TrafficSourceAnalysis from './pages/TrafficSourceAnalysis';
import SearchBehavior from './pages/SearchBehavior';
import SummaryDashboard from './pages/SummaryDashboard';

const NAV_ITEMS = [
  { id: 'summary', label: 'Обзор', icon: LayoutDashboard },
  { id: 'funnel', label: 'Воронка продаж', icon: Filter },
  { id: 'paths', label: 'Пути пользователей', icon: ArrowRightLeft },
  { id: 'dropoff', label: 'Анализ уходов', icon: Percent },
  { id: 'device', label: 'Типы устройств', icon: Users },
  { id: 'source', label: 'Источники трафика', icon: Search },
  { id: 'search', label: 'Поиск на сайте', icon: Search },
];

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 14, label: '14 дней' },
  { value: 30, label: '30 дней' },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('summary');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [days, setDays] = useState(30);

  const renderContent = () => {
    switch (activeTab) {
      case 'summary': return <SummaryDashboard days={days} />;
      case 'funnel': return <FunnelChart days={days} />;
      case 'paths': return <UserPathExplorer days={days} />;
      case 'dropoff': return <DropOffAnalysis days={days} />;
      case 'device': return <DeviceComparison days={days} />;
      case 'source': return <TrafficSourceAnalysis days={days} />;
      case 'search': return <SearchBehavior days={days} />;
      default: return <SummaryDashboard days={days} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-slate-200">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 z-50 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} bg-surface border-r border-slate-700/50`}>
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-700/20 mb-6">
          <div className="bg-primary/20 p-2 rounded-lg">
             <Filter className="w-6 h-6 text-primary" />
          </div>
          {sidebarOpen && <span className="font-bold text-xl tracking-tight text-white">05.ru Аналитика</span>}
        </div>
        
        <nav className="px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id ? 'bg-primary/10 text-primary shadow-lg shadow-primary/10' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <button 
           onClick={() => setSidebarOpen(!sidebarOpen)}
           className="absolute bottom-6 right-6 p-2 rounded-full hover:bg-slate-800/80 transition-colors"
        >
            {sidebarOpen ? <X className="w-5 h-5 text-slate-500" /> : <Menu className="w-5 h-5 text-slate-500" />}
        </button>
      </aside>

      {/* Main content */}
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'} p-8`}>
        <header className="mb-10 flex justify-between items-center">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">{NAV_ITEMS.find(n => n.id === activeTab)?.label}</h1>
                <p className="text-slate-400">Аналитика поведения пользователей на 05.ru</p>
             </div>
             
             <div className="flex items-center gap-4">
               {/* Period Selector */}
               <div className="flex bg-surface p-1 rounded-xl border border-slate-700/50 shadow-xl">
                 {PERIOD_OPTIONS.map((option) => (
                   <button
                     key={option.value}
                     onClick={() => setDays(option.value)}
                     className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                       days === option.value 
                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                     }`}
                   >
                     {option.label}
                   </button>
                 ))}
               </div>

               <div className="flex items-center gap-4 bg-surface p-2 rounded-xl border border-slate-700/50 shadow-xl">
                   <div className="px-3 py-1 border-r border-slate-700/50 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block leading-none mb-1">Сегодня</span>
                        <span className="text-sm font-medium text-white">{new Date().toLocaleDateString('ru-RU')}</span>
                      </div>
                   </div>
                   <div className="px-3 py-1">
                      <span className="text-[10px] text-slate-500 uppercase block leading-none mb-1 text-right">Статус данных</span>
                      <span className="flex items-center gap-1.5 text-success text-sm font-medium">
                          <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                          Supabase Live
                      </span>
                   </div>
               </div>
             </div>
        </header>
        
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
