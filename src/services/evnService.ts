import { toast } from 'sonner';

export interface EVNConfig {
  domain: string;
  username: string;
  password: string;
  token?: string;
  tokenTime?: number;
}

const DEFAULT_EVN_CONFIG: EVNConfig = {
  domain: 'http://evngenco2.web.esdglobal.com.vn',
  username: 'spfarm',
  password: 'Q1w2e3r4',
};

export const getEVNConfig = (): EVNConfig => {
  const domain = localStorage.getItem('EVN_DOMAIN') || DEFAULT_EVN_CONFIG.domain;
  const username = localStorage.getItem('EVN_USERNAME') || DEFAULT_EVN_CONFIG.username;
  const password = localStorage.getItem('EVN_PASSWORD') || DEFAULT_EVN_CONFIG.password;
  const token = localStorage.getItem('EVN_TOKEN') || undefined;
  const tokenTimeRaw = localStorage.getItem('EVN_TOKEN_TIME');
  const tokenTime = tokenTimeRaw ? parseInt(tokenTimeRaw, 10) : undefined;

  return { domain, username, password, token, tokenTime };
};

export const saveEVNConfig = (config: Partial<EVNConfig>) => {
  if (config.domain !== undefined) localStorage.setItem('EVN_DOMAIN', config.domain);
  if (config.username !== undefined) localStorage.setItem('EVN_USERNAME', config.username);
  if (config.password !== undefined) localStorage.setItem('EVN_PASSWORD', config.password);
  if (config.token !== undefined) {
    if (config.token) {
      localStorage.setItem('EVN_TOKEN', config.token);
      localStorage.setItem('EVN_TOKEN_TIME', Date.now().toString());
    } else {
      localStorage.removeItem('EVN_TOKEN');
      localStorage.removeItem('EVN_TOKEN_TIME');
    }
  }
};

/**
 * Login to EVN API to fetch authentication UserTokenKey
 */
export const loginToEVN = async (customConfig?: Partial<EVNConfig>): Promise<string> => {
  const cfg = { ...getEVNConfig(), ...customConfig };
  
  // Try proxy endpoint first to bypass browser CORS / HTTPS mixed content restriction
  const targets = [
    '/_vt_api/Authentication/ValidateUserRemote',
    `${cfg.domain.replace(/\/$/, '')}/_vt_api/Authentication/ValidateUserRemote`
  ];

  let lastError: any = null;

  for (const url of targets) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `${cfg.domain}/passport/login`,
        },
        body: JSON.stringify({
          UserName: cfg.username,
          Password: cfg.password,
          Captcha: '',
          Remember: true,
          UseSSO: false
        })
      });

      if (!response.ok) {
        throw new Error(`EVN Login status ${response.status}`);
      }

      const resData = await response.json();
      const token = resData.UserTokenKey || resData.CurrentUser?.UserTokenKey || resData.Data?.UserTokenKey;

      if (token) {
        saveEVNConfig({ token });
        console.log('✅ EVN Token obtained successfully');
        return token;
      } else if (resData.Message) {
        throw new Error(resData.Message);
      }
    } catch (err: any) {
      console.warn(`EVN Login attempt to ${url} failed:`, err);
      lastError = err;
    }
  }

  throw new Error(lastError?.message || 'Không thể kết nối EVN. Vui lòng kiểm tra lại cấu hình.');
};

/**
 * Upload an image/file to EVN ESD Storage
 */
export const uploadToEVN = async (file: File): Promise<{ url: string; data: any }> => {
  const cfg = getEVNConfig();
  let token = cfg.token;

  // Auto login if no token stored
  if (!token) {
    token = await loginToEVN();
  }

  const doUpload = async (authToken: string) => {
    const formData = new FormData();
    const fileTitle = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    
    formData.append('SPQueryApi', JSON.stringify({
      List: 'Photos',
      Properties: { Title: fileTitle },
      Document: { ItemUrl: '/Lists/TaiLieu', Overwise: false }
    }));
    
    formData.append('DocumentFileData_TaiLieu_0', file, file.name);

    const targets = [
      '/_api_prefix/System/AddItemWithAttachments',
      `${cfg.domain.replace(/\/$/, '')}/_api_prefix/System/AddItemWithAttachments`
    ];

    let lastError: any = null;

    for (const url of targets) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Authorize ${authToken}`,
            'Referer': `${cfg.domain}/dm-dungchung/tai-lieu`,
            'Accept': 'application/json, text/plain, */*'
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Upload HTTP error ${response.status}`);
        }

        const result = await response.json();

        // Update token if returned in response
        const newToken = result.UserTokenKey || result.CurrentUser?.UserTokenKey;
        if (newToken) {
          saveEVNConfig({ token: newToken });
        }

        if (result.Success && result.Data?.Url) {
          const fullUrl = `${cfg.domain.replace(/\/$/, '')}${result.Data.Url}`;
          return { url: fullUrl, data: result.Data };
        } else {
          throw new Error(result.Message || 'Upload không thành công');
        }
      } catch (err) {
        console.warn(`EVN Upload attempt to ${url} failed:`, err);
        lastError = err;
      }
    }

    throw lastError || new Error('Upload tới EVN thất bại.');
  };

  try {
    return await doUpload(token);
  } catch (err) {
    // Retry once with fresh token
    console.log('Retrying EVN upload with fresh token...');
    const freshToken = await loginToEVN();
    return await doUpload(freshToken);
  }
};

/**
 * Unified file upload handler with provider fallback
 */
export const uploadImageWithFallback = async (file: File): Promise<string> => {
  const provider = localStorage.getItem('STORAGE_PROVIDER') || 'EVN';

  if (provider === 'Drive API') {
    try {
      const driveToken = localStorage.getItem('DRIVE_API_TOKEN');
      if (!driveToken) throw new Error('Drive API chưa cấu hình token');
      // If Drive API upload succeeds: return drive url
      throw new Error('Drive API upload failed');
    } catch (driveErr) {
      toast.info('Drive API không khả dụng. Đang chuyển sang upload qua EVN ESD Storage...');
      const evnResult = await uploadToEVN(file);
      return evnResult.url;
    }
  }

  // Default EVN provider
  const evnResult = await uploadToEVN(file);
  return evnResult.url;
};
