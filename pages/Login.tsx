import React, { useState } from 'react';

import { Lock, User as UserIcon, Loader2, ShieldCheck, Building2, ArrowRight } from 'lucide-react';

import { chatService } from '../services/api';
import { User } from '../types';

interface LoginProps {
    onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('lawyer'); // Prefill for easy testing
    const [password, setPassword] = useState('123456');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await chatService.login({ username, password });
            if ((res as any).success) {
                const { token, ...user } = (res as any).data; // Extract token and user
                localStorage.setItem('an_im_user', JSON.stringify(user));
                localStorage.setItem('token', token); // Save token for requests
                onLoginSuccess(user);
            } else {
                setError((res as any).message || '登录失败');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || '网络连接错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg mb-4">
                    <UserIcon className="text-white" size={24} />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    账号登录
                </h2>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700 border border-blue-100">
                    <p className="font-semibold mb-2">测试账号 (密码均为 123456):</p>
                    <ul className="space-y-1 list-disc pl-4">
                        <li><span className="font-mono font-bold">lawyer</span> - 王律师 (资深法律顾问)</li>
                        <li><span className="font-mono font-bold">client</span> - 张总 (未来科技)</li>
                    </ul>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                用户名
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                                    placeholder="输入用户名"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                密码
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                                    placeholder="输入密码"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">{error}</h3>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                        登录中...
                                    </>
                                ) : (
                                    '登录'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
