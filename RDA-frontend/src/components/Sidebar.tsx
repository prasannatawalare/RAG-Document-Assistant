import { Home, BarChart3, Database, MessageSquare, Table, UserCircle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewTab = 'home' | 'dashboard' | 'knowledge' | 'chat' | 'sandbox' | 'agents';

interface SidebarProps {
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  onLogout: () => void;
  email: string;
}

export const Sidebar = ({ activeTab, setActiveTab, onLogout, email }: SidebarProps) => {
  const menuItems = [
    { id: 'home' as ViewTab, label: 'Project Hub (Home)', icon: Home },
    { id: 'dashboard' as ViewTab, label: 'Analytics Dashboard', icon: BarChart3 },
    { id: 'knowledge' as ViewTab, label: 'Knowledge Base', icon: Database },
    { id: 'chat' as ViewTab, label: 'Chat Assistant', icon: MessageSquare },
    { id: 'sandbox' as ViewTab, label: 'Data Sandbox', icon: Table },
    { id: 'agents' as ViewTab, label: 'AI Agent Studio', icon: UserCircle },
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col h-full border-r border-slate-200 flex-shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-200 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/30">
          R
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-wider uppercase">
            RAG Assistant
          </h1>
          <span className="text-xs text-indigo-600 font-semibold">
            AI & Data Sandbox
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 outline-none",
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-650")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3 px-2 py-3 rounded-lg bg-slate-100 border border-slate-200 mb-3 overflow-hidden">
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs flex-shrink-0">
            {email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">
              {email}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Local Session
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors outline-none"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
