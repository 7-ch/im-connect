import React, { useState, useRef, useEffect } from 'react';

import { ArrowLeft, Send, Paperclip, MoreVertical, Phone, Video, X, Image as ImageIcon, ZoomIn, Info, ShieldCheck, ChevronRight, MessageSquare } from 'lucide-react';

import { useToast } from './Toast';
import { Message, User, Role } from '../types';
import Avatar from './Avatar';
import ConfirmModal from './ConfirmModal';
import MessageBubble from './MessageBubble';
import { chatService } from '../services/api';
import { socketService } from '../services/socketService';
import { getFileIconProps } from '../utils/fileHelper';
import { uploadFileToOss } from '../utils/oss';

import { ACCEPT_STRING } from '@/utils/media';

interface ChatDetailProps {
  participant: User | null;
  onBack: () => void;
  currentUserRole?: Role;
  currentUserId: string;
  isOnline?: boolean;
}

const ChatDetail: React.FC<ChatDetailProps> = ({ participant, onBack, currentUserRole, currentUserId, isOnline }) => {
  const { error: showError } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // Staged files
  const [previewImage, setPreviewImage] = useState<string | null>(null); // State for image lightbox
  const [showProfileModal, setShowProfileModal] = useState(false); // State for expert profile modal
  const [showRecallModal, setShowRecallModal] = useState(false); // State for recall confirmation
  const [messageToRecall, setMessageToRecall] = useState<string | null>(null); // Message selected for recall

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to load messages
  const fetchMessages = async (pageNum: number) => {
    if (!participant) return;
    setIsLoadingHistory(true);
    try {
      const res = await chatService.getMessages(currentUserId, participant.id, pageNum, 20);
      if ((res as any).success) {
        const newMessages = (res as any).data || [];

        if (newMessages.length < 20) {
          setHasMore(false);
        }

        if (pageNum === 1) {
          setMessages(newMessages);
          setInitialLoading(false);
          // Optimized scroll for initial load
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          });
        } else {
          // Use function updater to access current scroll info before render logic if possible, 
          // but we need DOM info roughly at same time. 
          if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollHeightBefore = container.scrollHeight;
            const scrollTopBefore = container.scrollTop;

            setMessages(prev => {
              // Prepend new messages, filtering duplicates just in case
              const existingIds = new Set(prev.map(m => m.id));
              const uniqueNew = newMessages.filter((m: Message) => !existingIds.has(m.id));
              return [...uniqueNew, ...prev];
            });

            // Maintain scroll position
            // We depend on React synchronously flushing or use timeout.
            // A small timeout allows render to update scrollHeight.
            requestAnimationFrame(() => {
              if (container) {
                const scrollHeightAfter = container.scrollHeight;
                container.scrollTop = scrollHeightAfter - scrollHeightBefore + scrollTopBefore;
              }
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to load messages', e);
      if (pageNum === 1) setInitialLoading(false);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load messages from store and subscribe to changes
  useEffect(() => {
    // Reset state on participant change
    setMessages([]);
    setPage(1);
    setHasMore(true);
    setInputValue('');
    setPendingFiles([]);
    setShowProfileModal(false);
    setInitialLoading(true);

    if (participant) {
      // Initial Load
      fetchMessages(1);

      // Define separate function for marking read to use in different places
      const markRead = () => {
        chatService.markAsRead(currentUserId, participant.id).catch(err => console.error('Mark read failed', err));
      };

      // Initial mark read
      markRead();

      // Subscribe to socket for real-time updates
      const handleNewMessage = (data: any) => {
        if (data.type === 'NEW_MESSAGE') {
          const msg = data.payload;

          // Check if message belongs to this chat
          const isRelevant = msg.senderId === currentUserId && msg.receiverId === participant.id ||
            msg.senderId === participant.id && msg.receiverId === currentUserId;

          if (isRelevant) {
            setMessages(prev => {
              // 1. Exact ID Match (Deduplication)
              if (prev.some(m => m.id === msg.id)) {
                return prev;
              }

              // 2. Optimistic Match (Self-sent messages) - update sending to sent
              if (msg.senderId === currentUserId) {
                const optimisticMatch = prev.find(m =>
                  m.senderId === currentUserId &&
                  m.status === 'sending' &&
                  m.type === msg.type &&
                  (m.type === 'text' ? m.content === msg.content : true) &&
                  (m.type === 'file' || m.type === 'image' ? m.fileName === msg.fileName : true)
                );

                if (optimisticMatch) {
                  return prev.map(m => m.id === optimisticMatch.id ? msg : m);
                }
              }

              return [...prev, msg];
            });

            // Scroll for new messages if at bottom or is self
            if (scrollContainerRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
              if (isNearBottom || msg.senderId === currentUserId) {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
              }
            }

            // If incoming message is from the other person, mark it as read immediately
            if (msg.senderId === participant.id) {
              markRead(); // We are viewing the chat, so we read it.
            }
          }
        }

        // Handle Read Receipt Event
        if (data.type === 'MESSAGES_READ') {
          const { readerId, targetId } = data.payload;
          // If I am the target (my messages were read) AND it was read by the current chat participant
          if (targetId === currentUserId && readerId === participant.id) {
            setMessages(prev => prev.map(m =>
              // Update all my 'sent' messages to 'read'
              (m.senderId === currentUserId && m.status === 'sent') ? { ...m, status: 'read' } : m
            ));
          }
        }

        if (data.type === 'MESSAGE_RECALLED') {
          const { id } = data.payload;
          setMessages(prev => prev.map(m => m.id === id ? { ...m, recalled: true } : m));
        }
      };

      // Register handler
      const removeListener = socketService.onMessage(handleNewMessage);

      return () => {
        removeListener();
      };
    }
  }, [participant, currentUserId]); // DO NOT include fetchMessages dependencies

  // Handle Scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !isLoadingHistory) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(nextPage);
    }
  };

  const scrollToBottom = () => {
    // Small delay to allow react render cycle to complete and DOM to update
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };


  const handleSend = async () => {
    if ((!inputValue.trim() && pendingFiles.length === 0) || !participant) return;

    const now = Date.now();

    // --- 1. 处理文件发送 ---
    if (pendingFiles.length > 0) {
      const filesToUpload = [...pendingFiles];
      setPendingFiles([]); // Clear pending immediately

      filesToUpload.forEach(async (file, index) => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');

        let msgType = 'file';
        if (isImage) msgType = 'image';
        else if (isVideo) msgType = 'video';
        else if (isAudio) msgType = 'audio';

        const tempId = `temp_${now}_${index}`;

        // 1. Optimistic Message
        const tempMessage: Message = {
          id: tempId,
          senderId: currentUserId,
          receiverId: participant.id,
          content: URL.createObjectURL(file), // Show local preview immediately
          fileName: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          type: msgType as any,
          timestamp: Date.now(),
          status: 'sending',
          uploadProgress: 0,
        };

        setMessages(prev => [...prev, tempMessage]);
        scrollToBottom(); // Scroll for optimistic add


        try {
          // A. Upload to OSS with Progress
          const { ossObjectKey } = await uploadFileToOss(file, {
            onProgress: (percent) => {
              setMessages(prev => prev.map(m =>
                m.id === tempId ? { ...m, uploadProgress: percent } : m
              ));
            }
          });

          if (!ossObjectKey) throw new Error('Upload failed: No key returned');

          // B. Send to API
          const res = await chatService.sendMessage({
            senderId: currentUserId,
            receiverId: participant.id,
            content: ossObjectKey,
            type: msgType,
            fileName: file.name,
            fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`
          });

          // C. Update Local Message (Replace temp with real)
          if ((res as any).success) {
            const savedMsg = (res as any).data;
            setMessages(prev => prev.map(m =>
              m.id === tempId ? savedMsg : m
            ));
          } else {
            throw new Error('API send failed');
          }

        } catch (error) {
          console.error('File send failed', error);
          setMessages(prev => prev.map(m =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          ));
        }
      });
    }

    // --- 2. 处理文本发送 ---
    if (inputValue.trim()) {
      const content = inputValue;
      setInputValue(''); // Clear input

      try {
        const res = await chatService.sendMessage({
          senderId: currentUserId,
          receiverId: participant.id,
          content,
          type: 'text'
        });

        // Optimistically add? Or wait for socket? 
        // If we wait for socket, it might feel laggy (network).
        // If we add optimistically, we need to dedup when socket comes.
        // API returns the saved message.
        if ((res as any).success) {
          const savedMsg = (res as any).data;
          setMessages(prev => {
            // Deduplicate: If message with same ID exists (e.g. came via WebSocket already), ignore
            if (prev.some(m => m.id === savedMsg.id)) return prev;
            setTimeout(() => scrollToBottom(), 50); // Scroll after text send
            return [...prev, savedMsg];
          });
        }
      } catch (e) {
        console.error('Send failed', e);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const totalFiles = pendingFiles.length + selectedFiles.length;

      if (totalFiles > 5) {
        showError('一次最多只能上传5个文件');
        return;
      }

      setPendingFiles(prev => [...prev, ...selectedFiles]);
      // Reset input so same file can be selected again if removed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const pastedFiles = Array.from(e.clipboardData.files);
      const totalFiles = pendingFiles.length + pastedFiles.length;

      if (totalFiles > 5) {
        showError('一次最多只能上传5个文件');
        return;
      }

      setPendingFiles(prev => [...prev, ...pastedFiles]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Recall/Retry Logic
  const handleRecallMessage = (messageId: string) => {
    setMessageToRecall(messageId);
    setShowRecallModal(true);
  };

  const confirmRecall = async () => {
    if (!messageToRecall) return;

    // Close modal first/immediately or wait? Better UX to show loading? 
    // This simple modal doesn't support async loading state yet. 
    // We can close it immediately and show toast or just handle optimistically.
    setShowRecallModal(false);

    try {
      const res = await chatService.recallMessage(messageToRecall, currentUserId);
      if ((res as any).success) {
        // Optimistic update
        setMessages(prev => prev.map(m => m.id === messageToRecall ? { ...m, recalled: true } : m));
      } else {
        // Revert optimistic update
        setMessages(prev => prev.map(m => m.id === messageToRecall ? { ...m, recalled: false } : m));
        showError('撤回失败: ' + ((res as any).message || '未知错误'));
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.map(m => m.id === messageToRecall ? { ...m, recalled: false } : m));
      showError('撤回失败');
    } finally {
      setMessageToRecall(null);
    }
  };

  const handleRetryMessage = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    // Reset status to sending
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'sending', uploadProgress: (['file', 'image', 'video', 'audio'].includes(msg.type)) ? 0 : undefined } : m));

    try {
      let finalContent = msg.content;

      // Handle File/Image/Video/Audio Retry (Re-upload if blob)
      if (['file', 'image', 'video', 'audio'].includes(msg.type)) {
        if (msg.content.startsWith('blob:')) {
          try {
            const blobResponse = await fetch(msg.content);
            const blob = await blobResponse.blob();
            const file = new File([blob], msg.fileName || 'file', { type: blob.type });

            const { ossObjectKey } = await uploadFileToOss(file, {
              onProgress: (percent) => {
                setMessages(prev => prev.map(m =>
                  m.id === messageId ? { ...m, uploadProgress: percent } : m
                ));
              }
            });

            if (!ossObjectKey) throw new Error('Upload failed');
            finalContent = ossObjectKey;
          } catch (uploadError) {
            console.error('Retry Upload Failed', uploadError);
            throw uploadError;
          }
        }
      }

      // API Send
      const res = await chatService.sendMessage({
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        content: finalContent,
        type: msg.type,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
      });

      if ((res as any).success) {
        const savedMsg = (res as any).data;
        setMessages(prev => prev.map(m => m.id === messageId ? savedMsg : m));
      } else {
        throw new Error('API Send Failed');
      }

    } catch (e) {
      console.error('Retry failed', e);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'failed' } : m));
    }
  };

  const handleOpenProfile = () => {
    // Open profile for any role
    setShowProfileModal(true);
  };

  // Helper to format date for separators
  const getMessageDateLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (msgDate.getTime() === today.getTime()) {
      return timeStr;
    }
    if (msgDate.getTime() === yesterday.getTime()) {
      return `昨天 ${timeStr}`;
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return date.toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Fetch Expert Profile
  const [expertProfile, setExpertProfile] = useState<any>(null);

  useEffect(() => {
    if (participant) {
      chatService.getUserProfile(participant.id)
        .then((res: any) => {
          if (res.success) {
            const profile = res.data;
            // Parse specialty if it's a string
            if (typeof profile.specialty === 'string') {
              profile.specialty = profile.specialty.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
            }
            setExpertProfile(profile);
          }
        })
        .catch(err => console.error('Failed to fetch expert profile', err));
    } else {
      setExpertProfile(null);
    }
  }, [participant, currentUserRole]);

  if (!participant) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 h-full">
        <div className="text-center text-gray-400">
          <div className="w-24 h-24 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-300">
            <MessageSquare size={48} />
          </div>
          <p className="text-lg font-medium">选择一个会话开始聊天</p>
        </div>
      </div>
    );
  }

  const canViewProfile = true;

  return (
    <div className="flex flex-col h-full bg-[#f3f4f6] w-full relative">
      {/* Header */}
      <div className="bg-white px-4 h-16 flex items-center justify-between border-b border-gray-200 shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center cursor-pointer" onClick={handleOpenProfile}>
          <button
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            className="mr-2 p-2 hover:bg-gray-100 rounded-full md:hidden text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <Avatar name={participant.name} src={participant.avatar} />
          <div className="ml-3 group">
            <h2 className="font-bold text-gray-900 text-sm md:text-base flex items-center">
              {participant.name}
              {canViewProfile && <ChevronRight size={16} className="text-gray-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </h2>
            <div className="flex items-center text-xs text-gray-500">
              {isOnline ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 flex-shrink-0"></span>
                  <span className="mr-1.5">在线</span>
                </>
              ) : (
                <span className="mr-1.5">离线</span>
              )}
              <span>·</span>
              <p className="ml-1.5 truncate">{participant.organization || participant.title}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-gray-500">
          <button className="p-2 hover:bg-gray-100 rounded-full hidden sm:block"><Phone size={20} /></button>
          <button className="p-2 hover:bg-gray-100 rounded-full hidden sm:block"><Video size={20} /></button>
          <button
            className="p-2 hover:bg-gray-100 rounded-full"
            onClick={handleOpenProfile}
          >
            {canViewProfile ? <Info size={20} /> : <MoreVertical size={20} />}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        onScroll={handleScroll}
      >
        {initialLoading ? (
          <div className="flex items-center justify-center h-full z-10">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {isLoadingHistory && (
              <div className="flex justify-center py-4 w-full relative z-10">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            )}
            {messages.map((msg, index) => {
              // Determine if we should show a time separator
              const prevMsg = messages[index - 1];
              // Show if it's the first message OR difference is > 5 minutes
              const showDate = !prevMsg || (msg.timestamp - prevMsg.timestamp > 5 * 60 * 1000);

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-4 relative z-0">
                      <span className="text-xs text-gray-400 bg-gray-200 px-3 py-1 rounded-full">
                        {getMessageDateLabel(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isMe={msg.senderId === currentUserId}
                    senderAvatar={participant.avatar}
                    senderName={participant.name}
                    onRecall={handleRecallMessage}
                    onRetry={handleRetryMessage}
                    onImageClick={setPreviewImage}
                  />
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area Wrapper */}
      <div className="bg-white p-3 md:p-4 border-t border-gray-200">

        {/* Pending Files Preview */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-col gap-2 pb-3 mb-1">
            {pendingFiles.map((file, i) => {
              const isImage = file.type.startsWith('image/');
              const { Icon, color, bg } = getFileIconProps(file.name);
              const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
              const size = (file.size / 1024 / 1024).toFixed(2);

              return (
                <div key={i} className="relative flex items-center p-3 bg-white rounded-xl border border-gray-200 shadow-sm group w-full max-w-sm">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bg || 'bg-gray-100'} ${color || 'text-gray-500'}`}>
                    {isImage ? (
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg" alt="preview" />
                    ) : (
                      <Icon size={20} />
                    )}
                  </div>
                  <div className="ml-3 flex-1 min-w-0 pr-6">
                    <div className="text-gray-900 text-sm font-medium truncate" title={file.name}>{file.name}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{size} MB</div>
                  </div>
                  <button
                    onClick={() => removePendingFile(i)}
                    className="absolute top-1/2 -translate-y-1/2 right-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Input Controls */}
        <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 p-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="上传文件/图片"
          >
            <Paperclip size={20} />
          </button>
          <input
            type="file"
            accept={ACCEPT_STRING}
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            multiple
          />

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息..."
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-2 px-2 text-sm md:text-base text-gray-800 self-center"
            rows={1}
            style={{ minHeight: '40px' }}
          />

          <button
            onClick={handleSend}
            disabled={!inputValue.trim() && pendingFiles.length === 0}
            className={`p-2 rounded-lg ml-1 transition-all flex-shrink-0 ${inputValue.trim() || pendingFiles.length > 0
              ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Image Preview Overlay (Lightbox) */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 transition-opacity duration-300 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={previewImage}
            className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
            alt="Full preview"
          />
        </div>
      )}

      {/* Expert Profile Modal */}
      {showProfileModal && expertProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transform transition-all scale-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-blue-600 p-6 text-white text-center relative">
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-20 h-20 mx-auto rounded-full bg-white p-1 mb-3 shadow-lg">
                <Avatar name={expertProfile.name} src={expertProfile.avatar} size="xl" className="!w-full !h-full" />
              </div>
              <h3 className="text-xl font-bold flex items-center justify-center">
                {expertProfile.name}
                <ShieldCheck size={18} className="ml-1.5 text-blue-200" />
              </h3>
              <p className="text-blue-100 text-sm mt-1">{participant.organization}</p>
              <p className="text-blue-200 text-xs mt-0.5">{expertProfile.title}</p>
              {expertProfile.mobile && (
                <div className="mt-3 bg-blue-700/50 rounded-lg px-3 py-1.5 inline-flex items-center">
                  <Phone size={14} className="mr-1.5 text-blue-200" />
                  <span className="text-sm font-medium">{expertProfile.mobile}</span>
                </div>
              )}
            </div>
            <div className="p-6">
              {expertProfile.bio ? (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">简介</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">{expertProfile.bio}</p>
                </div>
              ) : (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">简介</h4>
                  <p className="text-gray-400 text-sm italic">暂无简介</p>
                </div>
              )}

              {expertProfile.specialty && expertProfile.specialty.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">擅长领域</h4>
                  <div className="flex flex-wrap gap-2">
                    {expertProfile.specialty.map((tag: string) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md border border-gray-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowProfileModal(false)}
              className="w-full mt-6 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Confirm Recall Modal */}
      <ConfirmModal
        isOpen={showRecallModal}
        onClose={() => setShowRecallModal(false)}
        onConfirm={confirmRecall}
        title="确认撤回"
        content="撤回后，对方将无法看到这条消息。只有发送时间在 24 小时内的消息可以撤回。"
        confirmText="确认撤回"
        isDanger={true}
      />
    </div>
  );
};

export default ChatDetail;