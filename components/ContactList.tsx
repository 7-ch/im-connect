import React, { useEffect, useState, useCallback } from 'react';

import { MessageSquare, MapPin, Building2, Phone, ShieldCheck, FileBadge, Search, Inbox, X, Users, Crown } from 'lucide-react';

import { Role, User } from '../types';
import Avatar from './Avatar';
import { useToast } from './Toast';
import { chatService } from '../services/api';

interface ContactListProps {
  currentUserRole: Role;
  onStartChat: (participantId: string) => void;
}

const ContactList: React.FC<ContactListProps> = ({ currentUserRole, onStartChat }) => {
  const { info } = useToast();
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true); // Default true until first load check
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchContacts = useCallback(async (pageNum: number, isLoadMore: boolean = false, query: string = '') => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await chatService.getContacts(currentUserRole, pageNum, 10, query);

      let newContacts: any[] = [];
      let total = 0;
      let totalPages = 1;

      if (Array.isArray(res)) {
        // Legacy array support
        newContacts = res;
        setHasMore(false); // Assume no pagination if array returned directly
      } else if ((res as any).success && (res as any).data) { // Handle ApiResponse wrapper
        const payload = (res as any).data;
        // Check if payload is paginated (has meta) or just array
        if (payload.meta && Array.isArray(payload.data)) {
          newContacts = payload.data;
          total = payload.meta.total;
          totalPages = payload.meta.totalPages;
          setHasMore(pageNum < totalPages);
        } else if (Array.isArray(payload)) {
          newContacts = payload;
          setHasMore(false);
        }
      }

      if (isLoadMore) {
        setContacts(prev => [...prev, ...newContacts]);
      } else {
        setContacts(newContacts);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  }, [currentUserRole]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchContacts(1, false, searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [currentUserRole, searchQuery, fetchContacts]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchContacts(nextPage, true, searchQuery);
  };



  // Render Enterprise View (Seeing Experts)
  const renderEnterpriseView = () => (
    <div className="p-4 space-y-4">
      {contacts.map(contact => {
        const expert = contact as any;
        return (
          <div key={expert.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start">
              <Avatar name={expert.name} src={expert.avatar} size="lg" className="mr-4" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center">
                      {expert.name}
                      <ShieldCheck size={14} className="text-blue-500 ml-1" />
                    </h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded self-start">
                        {expert.title || '专家'}
                      </p>
                      {expert.mobile && (
                        <div className="flex items-center text-xs text-gray-500">
                          <Phone size={12} className="mr-1" />
                          <span>{expert.mobile}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onStartChat(expert.id)}
                    className="p-2 text-blue-600 bg-white border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    title="发起聊天"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>

                <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2">{expert.bio || '暂无介绍'}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Parse specialty if it's string from DB JSON or array */}
                  {(() => {
                    let specs: string[] = [];
                    if (Array.isArray(expert.specialty)) specs = expert.specialty;
                    else if (typeof expert.specialty === 'string') {
                      try { specs = JSON.parse(expert.specialty); } catch { specs = expert.specialty.split(','); }
                    }

                    return specs.map((tag, idx) => (
                      <span key={idx} className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-200 px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'Technology': return '科技企业';
      case 'Manufacturing': return '制造企业';
      case 'Service': return '服务企业';
      default: return '其他企业';
    }
  }

  // Render Expert View (Seeing Enterprises)
  const renderExpertView = () => (
    <div className="p-4 space-y-4">
      {contacts.map(contact => {
        const ent = contact as any;
        const orgName = ent.organization;
        const location = ent.address || '未知地点';

        return (
          <div key={ent.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-start justify-between">
              <div className="flex items-center flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3 shrink-0 text-blue-600">
                  <Building2 size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 break-words">{orgName}</h3>
                  <div className="flex items-center text-xs text-gray-500 mt-0.5">
                    <MapPin size={12} className="mr-1 shrink-0" />
                    {(ent.latitude && ent.longitude) ? (
                      <a
                        href={`https://uri.amap.com/marker?position=${ent.longitude},${ent.latitude}&name=${encodeURIComponent(orgName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                        title={`点击查看定位: ${location}`}
                      >
                        {location}
                      </a>
                    ) : (
                      <span className="break-all" title={location}>
                        {location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Button Removed from here */}
            </div>

            {/* Details */}
            <div className="p-4 text-sm space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {ent.creditCode && (
                  <div className="flex items-center text-gray-600 col-span-2">
                    <FileBadge size={14} className="mr-2 text-gray-400 shrink-0" />
                    <span className="break-all" title={ent.creditCode}>信用代码：{ent.creditCode}</span>
                  </div>
                )}
                <div className="flex items-center text-gray-600 col-span-2">
                  <Building2 size={14} className="mr-2 text-gray-400" />
                  <span>单位类型：{getTypeLabel(ent.enterpriseType)}</span>
                </div>
              </div>

              {/* Contacts List - Adapted from DB User */}
              <div className="border-t border-gray-100 pt-3 mt-2">
                <div className="flex items-center mb-2">
                  <Users size={14} className="mr-2 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-400 uppercase">联系人</p>
                </div>
                <div className="space-y-2">
                  {/* Enterprise contacts list */}
                  {ent.contacts && Array.isArray(ent.contacts) ? (
                    ent.contacts.map((c: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 px-3 py-2.5 rounded-lg border border-gray-100/50 hover:bg-blue-50/50 transition-colors group">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center mb-1 gap-2">
                            <span className="font-bold text-gray-700 text-sm truncate">{c.name}</span>
                            {c.isPrimary && (
                              <button
                                onClick={(e) => { e.stopPropagation(); info('主要联系人'); }}
                                className="flex items-center justify-center w-5 h-5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full hover:bg-amber-100 transition-colors shrink-0 cursor-pointer focus:outline-none"
                                title="主要联系人"
                              >
                                <Crown size={12} className="fill-current" />
                              </button>
                            )}
                            {c.title && <span className="text-xs text-gray-500 font-normal truncate max-w-[80px]">({c.title})</span>}
                          </div>
                          <div className="flex items-center text-gray-500 text-xs">
                            <Phone size={12} className="mr-1 text-gray-400" />
                            <span className="truncate">{c.phone || '-'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onStartChat(ent.id)}
                          className="p-2 text-blue-600 bg-white border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          title="发起聊天"
                        >
                          <MessageSquare size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    // Fallback: Show the user identifying as this enterprise
                    <div className="flex justify-between items-center bg-gray-50 px-3 py-2.5 rounded-lg border border-gray-100/50 hover:bg-blue-50/50 transition-colors group">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center mb-1 gap-2">
                          <span className="font-bold text-gray-700 text-sm truncate">{ent.name}</span>
                          <div
                            onClick={(e) => { e.stopPropagation(); info('主要联系人'); }}
                            className="flex items-center justify-center w-5 h-5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full hover:bg-amber-100 transition-colors shrink-0 cursor-pointer focus:outline-none"
                            title="主要联系人"
                          >
                            <Crown size={12} className="fill-current" />
                          </div>
                          {ent.title && <span className="text-xs text-gray-500 font-normal truncate max-w-[80px]">({ent.title})</span>}
                        </div>
                        <div className="flex items-center text-gray-500 text-xs">
                          <Phone size={12} className="mr-1 text-gray-400" />
                          <span className="truncate">{ent.mobile || '-'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onStartChat(ent.id)}
                        className="p-2 text-blue-600 bg-white border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="发起聊天"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div >
          </div >
        )
      })}
    </div >
  );

  return (
    <div className="h-full bg-gray-50 w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={currentUserRole === 'enterprise' ? "搜索专家姓名、职称或擅长领域..." : "搜索单位名称或统一社会信用代码..."}
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="min-h-full pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-3"></div>
              <span className="text-sm">加载中...</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
              <Inbox size={48} className="text-gray-200 mb-4" strokeWidth={1} />
              <p className="text-sm">
                {searchQuery ? '未找到相关结果' : '暂无联系人'}
              </p>
            </div>
          ) : (
            <>
              {currentUserRole === 'enterprise' ? renderEnterpriseView() : renderExpertView()}

              {hasMore && (
                <div className="p-4 flex justify-center pb-8">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm hover:bg-gray-50 hover:text-blue-600 disabled:opacity-50 transition-all shadow-sm flex items-center"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                        加载中...
                      </>
                    ) : (
                      '加载更多'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactList;
