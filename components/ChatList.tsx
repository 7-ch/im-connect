import React, { useState, useMemo } from 'react';

import { Search, X, Inbox } from 'lucide-react';

import { Conversation, Role } from '../types';
import Avatar from './Avatar';

interface ChatListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  currentUserRole: Role;
  onlineUsers: Set<string>;
}

const ChatList: React.FC<ChatListProps> = ({ conversations, activeId, onSelect, currentUserRole, onlineUsers }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = useMemo(() => {
    return conversations
      .filter(item => {
        if (!item.participant) return false;
        const matchesName = item.participant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
        const matchesOrg = item.participant.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
        const matchesLastMsg = item.lastMessage?.content?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
        return matchesName || matchesOrg || matchesLastMsg;
      })
      .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  }, [conversations, searchTerm]);

  // Enhanced time formatting logic
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();

    // Create Date objects set to midnight for date comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Case 1: Today -> Show time (e.g., 14:30)
    if (msgDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    // Case 2: Yesterday -> Show "Yesterday" (e.g., 昨天)
    if (msgDate.getTime() === yesterday.getTime()) {
      return '昨天';
    }

    // Case 3: Within last 7 days -> Show Weekday (e.g., 星期二)
    const diffTime = today.getTime() - msgDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays < 7 && diffDays > 0) {
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return weekdays[date.getDay()];
    }

    // Case 4: Older -> Show Date (e.g., 23/10/05)
    const year = date.getFullYear().toString().slice(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full md:w-80 lg:w-96">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            id="search-input"
            name="search"
            type="text"
            placeholder="搜索会话、联系人..."
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
            <Inbox size={48} className="text-gray-200 mb-4" strokeWidth={1} />
            <p className="text-sm">
              {searchTerm ? '未找到相关会话' : '暂无会话'}
            </p>
          </div>
        ) : (
          filteredConversations.map((item) => {
            const isExpert = item.participant?.role === 'expert';
            // Tag logic: Use Title if available, else generic role name
            const tagText = item.participant?.title || (isExpert ? '专家' : '客户');
            const tagClass = isExpert
              ? 'bg-blue-50 text-blue-600 border-blue-100'
              : 'bg-emerald-50 text-emerald-600 border-emerald-100';

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`group flex items-center p-3 cursor-pointer transition-colors border-b border-gray-50 hover:bg-gray-50 ${activeId === item.id ? 'bg-blue-50/60' : ''
                  }`}
              >
                <div className="relative mr-3 self-start mt-1">
                  <Avatar name={item.participant?.name} src={item.participant?.avatar} size="md" />
                  {item.unreadCount > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-[10px] text-white font-bold px-1 leading-none">
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </span>
                    </div>
                  )}
                  {item.participant && onlineUsers.has(item.participant.id) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                  {/* Row 1: Name, Tag, Time */}
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate mr-1.5">
                        {item.participant?.name}
                      </h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tagClass} flex-shrink-0 max-w-[80px] truncate`}>
                        {tagText}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {formatTime(item.lastMessage?.timestamp)}
                    </span>
                  </div>

                  {/* Row 2: Organization (New Line) */}
                  {item.participant?.organization && (
                    <div className="mb-1">
                      <p className="text-xs text-gray-400 truncate w-full">
                        {item.participant.organization}
                      </p>
                    </div>
                  )}

                  {/* Row 3: Message Preview */}
                  <div className="flex justify-between items-center">
                    <p className={`text-xs truncate max-w-[90%] ${item.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                      {item.lastMessage?.recalled ?
                        (item.lastMessage.senderId === item.participant?.id ? '[对方撤回了一条消息]' : '[您撤回了一条消息]') :
                        item.lastMessage?.type === 'image' ? '[图片]' :
                          item.lastMessage?.type === 'file' ? '[文件]' :
                            item.lastMessage?.type === 'video' ? '[视频]' :
                              item.lastMessage?.content || '暂无消息'}
                    </p>
                    {item.pinned && (
                      <div className="w-2 h-2 rounded-full bg-gray-300 ml-1 flex-shrink-0" title="置顶"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatList;