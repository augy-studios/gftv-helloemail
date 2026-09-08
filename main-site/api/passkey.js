import {
    createClient
} from '@supabase/supabase-js';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({
        error: 'Method not allowed'
    });

    const {
        action
    } = req.body || {};
    const host = req.headers.host;
    const rpID = host.split(':')[0];
    const expectedOrigin = `https://${host}`;

    const authHeader = req.headers.authorization;
    let currentUser = null;
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '').trim();
        const {
            data: session
        } = await supabase
            .from('hellomail_sessions')
            .select('*, hellomail_users(*)')
            .eq('token', token)
            .single();
        if (session) currentUser = session.hellomail_users;
    }

    // 1. REGISTER OPTIONS
    if (action === 'register-options') {
        if (!currentUser) return res.status(401).json({
            error: 'Unauthorized'
        });

        const options = await generateRegistrationOptions({
            rpName: 'GFTV HelloMail',
            rpID,
            userID: Buffer.from(currentUser.id),
            userName: currentUser.username,
            attestationType: 'none',
        });

        await supabase
            .from('hellomail_users')
            .update({
                current_challenge: options.challenge
            })
            .eq('id', currentUser.id);

        return res.status(200).json(options);
    }

    // 2. REGISTER VERIFY
    if (action === 'register-verify') {
        if (!currentUser) return res.status(401).json({
            error: 'Unauthorized'
        });
        const {
            credential
        } = req.body;

        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: currentUser.current_challenge,
            expectedOrigin,
            expectedRPID: rpID,
        });

        if (verification.verified && verification.registrationInfo) {
            const {
                credentialID,
                credentialPublicKey,
                counter
            } = verification.registrationInfo;

            await supabase.from('hellomail_passkeys').insert([{
                user_id: currentUser.id,
                credential_id: Buffer.from(credentialID).toString('base64url'),
                public_key: Buffer.from(credentialPublicKey).toString('base64url'),
                counter,
            }]);

            return res.status(200).json({
                verified: true
            });
        }
        return res.status(400).json({
            error: 'Passkey verification failed'
        });
    }

    // 3. LOGIN OPTIONS
    if (action === 'login-options') {
        const {
            username
        } = req.body;
        const {
            data: user
        } = await supabase
            .from('hellomail_users')
            .select('*')
            .eq('username', username)
            .single();

        if (!user) return res.status(404).json({
            error: 'User not found'
        });

        const {
            data: passkeys
        } = await supabase
            .from('hellomail_passkeys')
            .select('*')
            .eq('user_id', user.id);

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials: (passkeys || []).map(p => ({
                id: p.credential_id,
                type: 'public-key',
            })),
        });

        await supabase
            .from('hellomail_users')
            .update({
                current_challenge: options.challenge
            })
            .eq('id', user.id);

        return res.status(200).json(options);
    }

    // 4. LOGIN VERIFY
    if (action === 'login-verify') {
        const {
            username,
            credential
        } = req.body;
        const {
            data: user
        } = await supabase
            .from('hellomail_users')
            .select('*')
            .eq('username', username)
            .single();

        if (!user) return res.status(404).json({
            error: 'User not found'
        });
        if (!user.is_approved) return res.status(403).json({
            error: 'Your account is pending administrator approval.'
        });

        const {
            data: passkey
        } = await supabase
            .from('hellomail_passkeys')
            .select('*')
            .eq('credential_id', credential.id)
            .single();

        if (!passkey) return res.status(400).json({
            error: 'Passkey not found'
        });

        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge: user.current_challenge,
            expectedOrigin,
            expectedRPID: rpID,
            authenticator: {
                credentialID: passkey.credential_id,
                credentialPublicKey: Buffer.from(passkey.public_key, 'base64url'),
                counter: passkey.counter,
            },
        });

        if (verification.verified) {
            const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
            await supabase.from('hellomail_sessions').insert([{
                token,
                user_id: user.id,
                expires_at: new Date(Date.now() + 86400000 * 7).toISOString()
            }]);

            return res.status(200).json({
                token,
                user: {
                    id: user.id,
                    username: user.username
                }
            });
        }
        return res.status(400).json({
            error: 'Passkey login failed'
        });
    }

    return res.status(400).json({
        error: 'Invalid action'
    });
}
