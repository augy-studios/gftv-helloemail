import {
    createClient
} from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getAdminUser(req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;

    const {
        data: session
    } = await supabase
        .from('hellomail_sessions')
        .select('user_id')
        .eq('token', token)
        .single();

    if (!session) return null;

    const {
        data: user
    } = await supabase
        .from('hellomail_users')
        .select('id, is_admin')
        .eq('id', session.user_id)
        .single();

    return user && user.is_admin ? user : null;
}

export default async function handler(req, res) {
    const admin = await getAdminUser(req);
    if (!admin) return res.status(403).json({
        error: 'Forbidden: Admin access required'
    });

    // List all users
    if (req.method === 'GET') {
        const {
            data: users,
            error
        } = await supabase
            .from('hellomail_users')
            .select('id, username, email, is_approved, is_admin, created_at')
            .order('created_at', {
                ascending: false
            });

        if (error) return res.status(400).json({
            error: error.message
        });
        return res.status(200).json({
            users
        });
    }

    // Update user approval status
    if (req.method === 'POST') {
        const {
            userId,
            isApproved
        } = req.body;

        const {
            error
        } = await supabase
            .from('hellomail_users')
            .update({
                is_approved: isApproved
            })
            .eq('id', userId);

        if (error) return res.status(400).json({
            error: error.message
        });
        return res.status(200).json({
            success: true
        });
    }

    res.status(400).json({
        error: 'Invalid action'
    });
}
