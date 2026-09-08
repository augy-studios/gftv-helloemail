import {
    createClient
} from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getUserFromToken(req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;

    const {
        data: session
    } = await supabase
        .from('hellomail_sessions')
        .select('user_id')
        .eq('token', token)
        .single();

    return session ? session.user_id : null;
}

export default async function handler(req, res) {
    const userId = await getUserFromToken(req);
    if (!userId) return res.status(401).json({
        error: 'Unauthorized'
    });

    if (req.method === 'GET' && req.query.action === 'list') {
        const {
            data: aliases
        } = await supabase
            .from('hellomail_aliases')
            .select('*')
            .eq('user_id', userId);
        return res.status(200).json({
            aliases
        });
    }

    if (req.method === 'POST') {
        const {
            action,
            prefix,
            destination,
            id
        } = req.body;

        if (action === 'create') {
            const alias_address = `${prefix}@globalfurry.tv`;
            const {
                data,
                error
            } = await supabase
                .from('hellomail_aliases')
                .insert([{
                    user_id: userId,
                    alias_address,
                    destination_email: destination
                }]);

            if (error) return res.status(400).json({
                error: error.message
            });
            return res.status(200).json({
                success: true,
                data
            });
        }

        if (action === 'delete') {
            await supabase.from('hellomail_aliases').delete().eq('id', id).eq('user_id', userId);
            return res.status(200).json({
                success: true
            });
        }
    }

    res.status(400).json({
        error: 'Invalid request'
    });
}
