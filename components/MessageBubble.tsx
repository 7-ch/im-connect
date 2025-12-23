import React, { useState } from 'react';

import { ExternalLink, Check, CheckCheck, Clock, AlertCircle, RotateCcw, Image as ImageIcon, Loader2 } from 'lucide-react';


import { useOssUrl } from '../hooks/useOssUrl';
import { Message } from '../types';
import { getFileIconProps } from '../utils/fileHelper';


interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  senderAvatar?: string;
  senderName?: string;
  onRecall?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onImageClick?: (imageUrl: string) => void;
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatFullTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, senderAvatar, senderName, onRecall, onRetry, onImageClick }) => {
  const [showActions, setShowActions] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const shouldSign = ['image', 'file', 'video', 'audio'].includes(message.type);
  const displayContent = useOssUrl(shouldSign ? message.content : undefined);

  // Check if message is recallable (within 24 hours and sent by me)
  const isRecallable = isMe &&
    message.status !== 'failed' &&
    !message.recalled &&
    (Date.now() - new Date(message.timestamp).getTime() < 24 * 60 * 60 * 1000);

  const renderStatus = () => {
    if (!isMe || message.recalled) return null;
    switch (message.status) {
      case 'sending':
        return <Clock size={12} className="text-gray-400 animate-spin" />;
      case 'sent':
        return <Check size={12} className="text-gray-400" />;
      case 'read':
        return <CheckCheck size={12} className="text-blue-500" />;
      case 'failed':
        return (
          <span className="text-red-500 text-[10px]">发送失败</span>
        );
      default: return null;
    }
  };

  // Function to convert URLs in text to clickable links
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
      <p className="whitespace-pre-wrap break-words text-sm sm:text-base">
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-200 underline hover:text-blue-100"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }
          return part;
        })}
      </p>
    );
  };

  const renderContent = () => {
    if (message.recalled) {
      return (
        <span className="text-gray-500 italic text-sm flex items-center">
          <RotateCcw size={14} className="mr-1.5" />
          您撤回了一条消息
        </span>
      );
    }

    switch (message.type) {
      case 'image':
        // eslint-disable-next-line no-case-declarations
        const showLoading = !displayContent || !imgLoaded;

        return (
          <div
            className={`relative group cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 ${message.status === 'sending' ? 'opacity-90' : ''}`}
            onClick={() => onImageClick && displayContent && onImageClick(displayContent)}
          >
            {/* 1. Uploading Spinner */}
            {message.status === 'sending' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 text-white backdrop-blur-[1px]">
                {message.uploadProgress !== undefined ? (
                  <>
                    <span className="text-xs font-medium mb-1">{message.uploadProgress}%</span>
                    <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  </>
                ) : (
                  <Clock className="animate-spin" size={24} />
                )}
              </div>
            )}

            {showLoading && message.status !== 'sending' && (
              <div className="absolute inset-0 z-10 w-full h-full bg-gray-300 flex items-center justify-center text-gray-400">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                <ImageIcon size={28} className="relative z-10 opacity-30" />
              </div>
            )}

            {/* 3. The Image */}
            {displayContent && (
              <img
                src={displayContent}
                alt="发送的图片"
                // While loading: absolute (out of flow) to not break spacer layout. Once loaded: relative (dictates size).
                className={`max-w-[200px] sm:max-w-[300px] max-h-[300px] object-cover transition-all duration-500 ease-out ${imgLoaded ? 'opacity-100 relative' : 'opacity-0 absolute top-0 left-0 w-full h-full'
                  }`}
                onLoad={() => setImgLoaded(true)}
              />
            )}

            {/* 4. Spacer: Enforces 200x150 size while loading */}
            {showLoading && <div className="w-[200px] h-[150px] bg-gray-100" />}
          </div>
        );
      case 'file':
        // eslint-disable-next-line no-case-declarations
        const { Icon, color, bg } = getFileIconProps(message.fileName || message.content);
        return (
          <a
            href={!message.uploadProgress ? displayContent : undefined} // Disable link while uploading
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center p-3 bg-white/10 rounded-lg border border-gray-200 dark:border-gray-700 min-w-[200px] max-w-[280px] hover:bg-white/20 transition-colors cursor-pointer text-inherit no-underline overflow-hidden"
            onClick={(e) => (!displayContent || message.uploadProgress !== undefined) && e.preventDefault()}
          >
            {/* Upload Progress Bar Background */}
            {message.status === 'sending' && message.uploadProgress !== undefined && (
              <div
                className="absolute left-0 bottom-0 top-0 bg-green-400/30 transition-all duration-200"
                style={{ width: `${message.uploadProgress}%`, zIndex: 0 }}
              />
            )}

            <div className={`${bg} p-2 rounded-lg ${color} mr-3 transition-colors flex-shrink-0 z-10`}>
              <Icon size={24} />
            </div>
            <div className="flex-1 overflow-hidden min-w-0 z-10">
              <p className="text-sm font-medium truncate" title={message.fileName || message.content}>
                {message.fileName || message.content}
              </p>
              <div className="flex justify-between items-center">
                <p className="text-xs opacity-70">{message.fileSize || '未知大小'}</p>
                {message.status === 'sending' && message.uploadProgress !== undefined && (
                  <span className="text-[10px] text-white/90 font-medium">{message.uploadProgress}%</span>
                )}
              </div>
            </div>
          </a>
        );
      case 'video':
        return (
          <div className="rounded-lg overflow-hidden bg-black max-w-[240px] sm:max-w-[320px]">
            <video
              src={displayContent}
              controls
              className="w-full h-auto max-h-[300px]"
              poster={undefined} // Could use a thumbnail if available
            >
              您的浏览器不支持视频播放。
            </video>
          </div>
        );
      case 'audio':
        return (
          <div className="flex items-center p-2 min-w-[200px]">
            <audio src={displayContent} controls className="w-full h-8" />
          </div>
        );
      case 'link':
        return (
          <a href="#" className="flex items-center text-blue-600 hover:underline break-all">
            <ExternalLink size={14} className="mr-1 flex-shrink-0" />
            {message.content}
          </a>
        );
      case 'text':
      default:
        return renderTextWithLinks(message.content);
    }
  };

  const fullTime = formatFullTime(message.timestamp);

  return (
    <div
      className={`flex w-full mb-4 group/bubble ${isMe ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => setShowActions(prev => !prev)}
    >
      {!isMe && (
        <div className="mr-2 flex-shrink-0 flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
            {senderAvatar ? <img src={senderAvatar} className="w-full h-full object-cover" /> : <span className="text-xs text-gray-600">{senderName?.[0]}</span>}
          </div>
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && <span className="text-xs text-gray-500 ml-1 mb-1">{senderName}</span>}

        <div className="relative">
          <div
            className={`transition-all ${message.type === 'image'
              ? 'p-0 bg-transparent' // Image: No padding, transparent bg
              : `px-4 py-2 shadow-sm ${ // Text/File: Bubble style
              message.recalled
                ? 'bg-gray-100 border border-gray-200 rounded-bl-xl rounded-br-xl'
                : isMe
                  ? 'bg-blue-600 text-white rounded-2xl rounded-br-none'
                  : 'bg-white text-gray-900 border border-gray-200 rounded-2xl rounded-bl-none'
              }`
              } ${message.status === 'failed' ? 'ring-2 ring-red-100' : ''}`}
          >
            {renderContent()}
          </div>

          {/* Context Actions (Recall) */}
          {isRecallable && (
            <div className={`absolute top-0 ${isMe ? '-left-8' : '-right-8'} h-full flex items-center transition-opacity duration-200 z-20 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
              <button
                onClick={() => onRecall && onRecall(message.id)}
                className="p-1.5 bg-gray-100 hover:bg-white rounded-full text-gray-500 shadow-sm border border-gray-200"
                title="撤回消息 (24小时内)"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          )}

          {/* Failed Retry Action - Interactive Button */}
          {message.status === 'failed' && isMe && (
            <div className="absolute top-1/2 -left-10 transform -translate-y-1/2 flex items-center justify-center">
              <button
                onClick={() => onRetry && onRetry(message.id)}
                className="p-2 rounded-full hover:bg-red-100 text-red-500 transition-colors group/retry"
                title="发送失败，点击重发"
              >
                <AlertCircle size={20} className="group-hover/retry:scale-110 transition-transform" />
              </button>
            </div>
          )}
        </div>

        <div className={`flex items-center mt-1 space-x-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
          <span className="text-[10px] text-gray-400 cursor-default">
            {showActions ? fullTime : formatTime(message.timestamp)}
          </span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;