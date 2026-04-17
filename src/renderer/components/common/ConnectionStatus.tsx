import React from "react";
import { useChatStore } from "../../store/chatStore";

const ConnectionStatus: React.FC = () => {
  const status = useChatStore((s) => s.connectionStatus);
  if (status === "connected") return null;

  return (
    <div className={`connection-status connection-status--${status}`} role="status">
      {status === "reconnecting" ? "Переподключение..." : "Нет соединения"}
    </div>
  );
};

export default ConnectionStatus;
