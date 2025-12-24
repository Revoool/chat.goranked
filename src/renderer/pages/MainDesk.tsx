import React from 'react';
import { useAuthStore } from '../store/authStore';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import ClientCard from '../components/ClientCard';
import Settings from '../components/Settings';
import { useChatStore } from '../store/chatStore';
import '../styles/MainDesk.css';

const MainDesk: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { selectedChatId, activeMenu, isClientCardOpen } = useChatStore();

  return (
    <div className="main-desk">
      <Sidebar user={user} onLogout={logout} />
      <div className="main-content">
        {activeMenu === 'settings' ? (
          <Settings />
        ) : (
          <>
            <ChatList />
            <div className="chat-area">
              {selectedChatId ? (
                <>
                  <ChatWindow chatId={selectedChatId} />
                  {isClientCardOpen && <ClientCard chatId={selectedChatId} />}
                </>
              ) : (
                <div className="empty-chat">
                  <p>Выберите чат для начала работы</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MainDesk;

