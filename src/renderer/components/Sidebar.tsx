import React, { useState } from 'react';
import { User } from '../types';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { IconInbox, IconUser, IconCheck, IconSettings, IconLogout } from '../icons';
import logoImage from '../assets/logo.png';
import '../styles/Sidebar.css';

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
}

type MenuItem = 'inbox' | 'assigned' | 'closed' | 'settings';

interface NavButtonProps {
  icon: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, title, active, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div 
      className="nav-button-wrapper" 
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button 
        className={`nav-item ${active ? 'active' : ''}`}
        onClick={onClick}
        title={title}
      >
        {icon}
      </button>
      {showTooltip && (
        <div className="nav-item-tooltip">
          {title}
        </div>
      )}
    </div>
  );
};

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
        <img 
          src={logoImage} 
          alt="Goranked" 
          className="sidebar-logo"
        />
      </div>

      <nav className="sidebar-nav">
        <NavButton
          icon={<IconInbox size={20} />}
          title="Вхідні"
          active={activeMenu === 'inbox'}
          onClick={() => handleMenuClick('inbox')}
        />
        <NavButton
          icon={<IconUser size={20} />}
          title="Призначені"
          active={activeMenu === 'assigned'}
          onClick={() => handleMenuClick('assigned')}
        />
        <NavButton
          icon={<IconCheck size={20} />}
          title="Закриті"
          active={activeMenu === 'closed'}
          onClick={() => handleMenuClick('closed')}
        />
        <NavButton
          icon={<IconSettings size={20} />}
          title="Налаштування"
          active={activeMenu === 'settings'}
          onClick={() => handleMenuClick('settings')}
        />
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.name.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
        <NavButton
          icon={<IconLogout size={20} />}
          title="Вийти"
          active={false}
          onClick={onLogout}
        />
      </div>
    </div>
  );
};

export default Sidebar;

