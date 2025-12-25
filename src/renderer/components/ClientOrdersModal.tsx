import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import '../styles/ClientOrdersModal.css';

interface ClientOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: number;
}

interface Order {
  id: number;
  type: 'service' | 'product';
  game?: string;
  boost_name?: string;
  product_name?: string;
  status?: string;
  status_id?: number;
  created_at?: string;
}

const ClientOrdersModal: React.FC<ClientOrdersModalProps> = ({ isOpen, onClose, chatId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersProducts, setOrdersProducts] = useState<Order[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client-orders', chatId],
    queryFn: () => apiClient.getClientOrders(chatId),
    enabled: isOpen && !!chatId,
  });

  useEffect(() => {
    if (data) {
      setOrders(data.orders || []);
      setOrdersProducts(data.orders_products || []);
    }
  }, [data]);

  useEffect(() => {
    if (isOpen && chatId) {
      refetch();
    }
  }, [isOpen, chatId, refetch]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleString('uk-UA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    return type === 'service' ? 'Послуга' : 'Товар';
  };

  const openOrder = (order: Order) => {
    // Базовый URL для открытия заказов на сайте
    const baseUrl = 'https://goranked.gg';
    
    if (order.type === 'service') {
      window.open(`${baseUrl}/orders/edit/${order.id}`, '_blank');
    } else {
      window.open(`${baseUrl}/products/orders/${order.id}`, '_blank');
    }
  };

  if (!isOpen) return null;

  const allOrders = [...orders, ...ordersProducts].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="client-orders-modal-overlay" onClick={onClose}>
      <div className="client-orders-modal" onClick={(e) => e.stopPropagation()}>
        <div className="client-orders-modal-header">
          <h2>Замовлення клієнта</h2>
          <button className="client-orders-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="client-orders-modal-content">
          {isLoading ? (
            <div className="client-orders-modal-loading">
              <div className="spinner" />
              <span>Завантаження...</span>
            </div>
          ) : allOrders.length === 0 ? (
            <div className="client-orders-modal-empty">
              Замовлень не знайдено
            </div>
          ) : (
            <div className="client-orders-modal-list">
              {allOrders.map((order) => (
                <div
                  key={`${order.type}-${order.id}`}
                  className="client-orders-modal-item"
                  onClick={() => openOrder(order)}
                >
                  <div className="client-orders-modal-item-icon">
                    {order.type === 'service' ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M3 3H17L15 12H5L3 3ZM3 3L2 1M6 16H10M14 16H10M10 16V14"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M3 7V17H17V7M3 7L10 2L17 7M3 7H17"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="client-orders-modal-item-content">
                    <div className="client-orders-modal-item-header">
                      <span className="client-orders-modal-item-id">#{order.id}</span>
                      <span className={`client-orders-modal-item-type client-orders-modal-item-type-${order.type}`}>
                        {getOrderTypeLabel(order.type)}
                      </span>
                      {order.game && (
                        <span className="client-orders-modal-item-game">{order.game}</span>
                      )}
                    </div>
                    <div className="client-orders-modal-item-name">
                      {order.type === 'service' ? order.boost_name || '—' : order.product_name || '—'}
                    </div>
                    <div className="client-orders-modal-item-footer">
                      {order.status && (
                        <span className={`client-orders-modal-item-status ${
                          (order.type === 'service' && order.status_id === 6) ||
                          (order.type === 'product' && order.status_id === 2)
                            ? 'client-orders-modal-item-status-success'
                            : ''
                        }`}>
                          {order.status}
                        </span>
                      )}
                      <span className="client-orders-modal-item-date">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="client-orders-modal-item-arrow">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M6 12L10 8L6 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="client-orders-modal-footer">
          <button className="client-orders-modal-button" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientOrdersModal;

