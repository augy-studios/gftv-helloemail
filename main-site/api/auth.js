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

    if (action === 'register') {
        const {
            data: user,
            error
        } = await supabase
            .from('helloemail_users')
            .insert([{
                username,
                email,
                password_hash: password
            }])
            .select()
            .single();

        if (error) return res.status(400).json({
            error: error.message
        });

        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await supabase.from('helloemail_sessions').insert([{
            token,
            user_id: user.id,
            expires_at: new Date(Date.now() + 86400000 * 7).toISOString()
        }]);

        return res.status(200).json({
            token
        });
    }

    if (action === 'login') {
        const {
            data: user
        } = await supabase
            .from('helloemail_users')
            .select('*')
            .eq('username', username)
            .eq('password_hash', password)
            .single();

        if (!user) return res.status(401).json({
            error: 'Invalid credentials'
        });

        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await supabase.from('helloemail_sessions').insert([{
            token,
            user_id: user.id,
            expires_at: new Date(Date.now() + 86400000 * 7).toISOString()
        }]);

        return res.status(200).json({
            token
        });
    }

    res.status(400).json({
        error: 'Invalid action'
    });
}
