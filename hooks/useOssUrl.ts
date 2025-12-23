import { useState, useEffect } from 'react';
import { getSignedUrl } from '../utils/oss';

/**
 * Custom hook to resolve OSS Object Key to a signed URL.
 * If the input is already a URL (http/data/blob), it returns it as is.
 */
export function useOssUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!path) {
      setUrl(undefined);
      return;
    }

    // If it's already a URL, use it directly (Mock data or blobs)
    if (/^(https?:\/\/|data:|blob:)/.test(path)) {
      setUrl(path);
      return;
    }

    // Assume it's an OSS Key -> Get Signed URL
    let active = true;
    getSignedUrl(path)
      .then((signed) => {
        if (active) setUrl(signed);
      })
      .catch((err) => {
        console.warn('Failed to sign url for', path, err);
        // Fallback or leave undefined
      });

    return () => {
      active = false;
    };
  }, [path]);

  return url;
}
