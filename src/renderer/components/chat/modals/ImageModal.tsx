import React, { useEffect } from 'react';
import { IconX } from '../../../icons';
import '../../../styles/ImageModal.css';

interface ImageModalProps {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, imageName, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="image-modal-backdrop" onClick={handleBackdropClick}>
      <div className="image-modal-container">
        <div className="image-modal-header">
          <span className="image-modal-title">{imageName || 'Зображення'}</span>
          <div className="image-modal-actions">
            <button
              className="image-modal-download-btn"
              onClick={handleDownload}
              title="Завантажити"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button
              className="image-modal-close-btn"
              onClick={onClose}
              title="Закрити (Esc)"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>
        <div className="image-modal-content">
          <img
            src={imageUrl}
            alt={imageName || 'Image'}
            className="image-modal-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageModal;

