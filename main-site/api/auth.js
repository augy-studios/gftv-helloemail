import {
    createClient
} from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const {
        action,
        username,
        password,
        email
    } = req.body;

    // 1. REGISTER
    if (action === 'register') {
        // New accounts default to is_approved = false
        const {
            data: user,
            error
        } = await supabase
            .from('hellomail_users')
            .insert([{
                username,
                email,
                password_hash: password,
                is_approved: false,
                is_admin: false
            }])
            .select()
            .single();

        if (error) return res.status(400).json({
            error: error.message
        });

        return res.status(200).json({
            message: 'Account created successfully. An administrator must approve your access before you can log in.'
        });
    }

    // 2. LOGIN
    if (action === 'login') {
        const {
            data: user
        } = await supabase
            .from('hellomail_users')
            .select('*')
            .eq('username', username)
            .eq('password_hash', password)
            .single();

        if (!user) return res.status(401).json({
            error: 'Invalid credentials'
        });

        // Block unapproved users
        if (!user.is_approved) {
            return res.status(403).json({
                error: 'Your account is pending administrator approval.'
            });
        }

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
                username: user.username,
                is_admin: user.is_admin
            }
        });
    }

    res.status(400).json({
        error: 'Invalid action'
    });
}
