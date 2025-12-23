import { config } from '@/config';

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  skipErrorHandler?: boolean;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  success: boolean;
}

// 简单的错误处理
const handleError = (status: number, message: string) => {
  console.error(`API Error [${status}]: ${message}`);
  // 这里可以集成 Toast 组件提示
  // toast.error(message);
  
  if (status === 401) {
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('an_im_user');
      window.location.reload();
    }
    // If no token, do nothing to avoid reload loop
  }
};

async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, skipErrorHandler, ...customConfig } = options;
  
  // 1. URL 处理
  let url = `${config.apiUrl}${endpoint}`;
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
    ).toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // 2. Headers 处理
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customConfig.headers,
  };

  // 自动添加 Token
  const token = localStorage.getItem('token');
  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  // 如果是上传文件，删除 Content-Type 让浏览器自动设置 boundary
  if (customConfig.body instanceof FormData) {
    delete (headers as any)['Content-Type'];
  }

  const configObj: RequestInit = {
    method: 'GET',
    headers,
    credentials: 'include',
    ...customConfig,
  };

  try {
    const response = await fetch(url, configObj);
    
    // 处理 HTTP 错误状态
    if (!response.ok) {
        const errorMsg = `HTTP error! status: ${response.status}`;
        if (!skipErrorHandler) handleError(response.status, errorMsg);
        throw new Error(errorMsg);
    }

    const data = await response.json();

    // 处理业务错误码 (假设后端约定 code === 0 或 200 为成功)
    if (data.code !== 0 && data.code !== 200) {
        if (!skipErrorHandler) handleError(data.code, data.message || 'Unknown Error');
        return { ...data, success: false }; // 让业务层决定是否 throw
    }

    return { ...data, success: true };
  } catch (error: any) {
    if (!skipErrorHandler) {
        handleError(500, error.message || 'Network Error');
    }
    throw error;
  }
}

// 导出常用的请求方法
export const http = {
  get: <T = any>(endpoint: string, params?: Record<string, any>, options?: RequestOptions) => 
    request<T>(endpoint, { ...options, method: 'GET', params }),
    
  post: <T = any>(endpoint: string, data?: any, options?: RequestOptions) => 
    request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
    
  put: <T = any>(endpoint: string, data?: any, options?: RequestOptions) => 
    request<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }),
    
  delete: <T = any>(endpoint: string, params?: Record<string, any>, options?: RequestOptions) => 
    request<T>(endpoint, { ...options, method: 'DELETE', params }),
    
  upload: <T = any>(endpoint: string, file: File, options?: RequestOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<T>(endpoint, { ...options, method: 'POST', body: formData });
  }
};