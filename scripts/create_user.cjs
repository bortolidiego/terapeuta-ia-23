
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
let env = {};

try {
    if (fs.existsSync(envPath)) {
        console.log('Reading .env from:', envPath);
        const envText = fs.readFileSync(envPath, 'utf-8');
        console.log('File size:', envText.length);

        envText.split(/\r?\n/).forEach(line => {
            line = line.trim();
            if (!line) return;
            if (line.startsWith('#')) return;

            const delimiterIndex = line.indexOf('=');
            if (delimiterIndex === -1) {
                console.log('Ignored line (no =):', line);
                return;
            }

            const key = line.substring(0, delimiterIndex).trim();
            let value = line.substring(delimiterIndex + 1).trim();

            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            env[key] = value;
            // console.log(`Parsed: ${key} = ${value.substring(0, 5)}...`);
        });
    } else {
        console.log('.env file not found at:', envPath);
    }
} catch (e) {
    console.error('Error reading .env:', e);
}

// Fallback removido para evitar conexao com localhost
// if (!env['VITE_SUPABASE_URL']) env['VITE_SUPABASE_URL'] = 'http://127.0.0.1:54331';

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? (supabaseKey.substring(0, 10) + '...') : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing keys in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Creating user bortolidiego@gmail.com...');

    const { data, error } = await supabase.auth.signUp({
        email: 'bortolidiego@gmail.com',
        password: 'Kb46837874#',
        options: {
            data: {
                full_name: 'Diego'
            }
        }
    });

    if (error) {
        if (error.message.includes('already registered')) {
            console.log('User already exists!');
        } else {
            console.error('Error creating user:', error.message);
            process.exit(1);
        }
    } else {
        console.log('User created ID:', data.user?.id);
        if (!data.session) {
            console.log('PENDING: User created but needs confirmation.');
        } else {
            console.log('SUCCESS: Session created automatically.');
        }
    }
}

main();
