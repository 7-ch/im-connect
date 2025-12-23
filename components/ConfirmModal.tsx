import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    content,
    confirmText = '确认',
    cancelText = '取消',
    isDanger = false
}) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !visible) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={`bg-white rounded-2xl w-full max-w-sm shadow-2xl transform transition-all duration-300 overflow-hidden ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                            {isDanger ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {title}
                    </h3>

                    <p className="text-sm text-gray-500 leading-relaxed mb-6">
                        {content}
                    </p>

                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-white shadow-md transition-colors ${isDanger
                                    ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
