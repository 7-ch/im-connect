import OSS from 'ali-oss';
import express from 'express';

import { sendResponse } from '../utils.js';

const router = express.Router();

// STS Endpoint
router.post('/oss/config', async (req, res) => {
    try {
        const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
        const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
        const roleArn = process.env.ALIBABA_CLOUD_ROLE_ARN;

        if (!accessKeyId || !accessKeySecret || !roleArn) {
            return sendResponse(res, null, false, 'Missing Server STS Configuration', 500);
        }

        const sts = new OSS.STS({
            accessKeyId,
            accessKeySecret
        });

        const result = await sts.assumeRole(roleArn, '', 3600, 'an-im-session');
        const creds = result.credentials;

        const data = {
            accessKeyId: creds.AccessKeyId,
            accessKeySecret: creds.AccessKeySecret,
            securityToken: creds.SecurityToken,
            bucket: process.env.OSS_BUCKET,
            region: process.env.OSS_REGION,
            endpoint: process.env.OSS_ENDPOINT,
            expiresIn: new Date(creds.Expiration).getTime()
        };

        sendResponse(res, data);

    } catch (e) {
        console.error('STS Error:', e);
        sendResponse(res, null, false, e.message, 500);
    }
});


export default router;
