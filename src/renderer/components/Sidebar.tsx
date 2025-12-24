import React from 'react';
import { User } from '../types';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import '../styles/Sidebar.css';

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
}

type MenuItem = 'inbox' | 'assigned' | 'closed' | 'settings';

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const { activeMenu, setActiveMenu, setFilters } = useChatStore();
  const { user: currentUser } = useAuthStore();

  const handleMenuClick = (menu: MenuItem) => {
    setActiveMenu(menu);
    
    switch (menu) {
      case 'inbox':
        // Show all chats
        setFilters({ status: undefined, manager_id: undefined });
        break;
      case 'assigned':
        // Show only assigned to current user
        if (currentUser?.id) {
          setFilters({ manager_id: currentUser.id });
        }
        break;
      case 'closed':
        // Show only closed chats
        setFilters({ status: 'closed' });
        break;
      case 'settings':
        // Settings page - handled by parent component
        break;
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-logo">Goranked</h2>
        <p className="sidebar-slogan">Go forward, get ranked!</p>
      </div>

      <nav className="sidebar-nav">
        <button 
          className={`nav-item ${activeMenu === 'inbox' ? 'active' : ''}`}
          onClick={() => handleMenuClick('inbox')}
        >
          <span>📥</span>
          <span>Inbox</span>
        </button>
        <button 
          className={`nav-item ${activeMenu === 'assigned' ? 'active' : ''}`}
          onClick={() => handleMenuClick('assigned')}
        >
          <span>👤</span>
          <span>Assigned</span>
        </button>
        <button 
          className={`nav-item ${activeMenu === 'closed' ? 'active' : ''}`}
          onClick={() => handleMenuClick('closed')}
        >
          <span>✅</span>
          <span>Closed</span>
        </button>
        <button 
          className={`nav-item ${activeMenu === 'settings' ? 'active' : ''}`}
          onClick={() => handleMenuClick('settings')}
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.name.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="user-role">{user?.role || 'agent'}</div>
          </div>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

