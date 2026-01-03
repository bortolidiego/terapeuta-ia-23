
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Ler .env manualmente
const envPath = path.resolve(process.cwd(), '.env')
const envText = fs.readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
envText.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
        let value = match[2].trim()
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
        env[match[1].trim()] = value
    }
})

const supabaseUrl = env['VITE_SUPABASE_URL']
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY']

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Config in .env')
    process.exit(1)
}

console.log(`Connecting to ${supabaseUrl}...`)

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log('Creating user bortolidiego@gmail.com...')

    const { data, error } = await supabase.auth.signUp({
        email: 'bortolidiego@gmail.com',
        password: 'Kb46837874#',
        options: {
            data: {
                full_name: 'Diego'
            }
        }
    })

    if (error) {
        console.error('Error:', error.message)
    } else {
        console.log('User created ID:', data.user?.id)
        if (data.session) {
            console.log('Session created automatically (Auto-confirm is ON)')
        } else {
            console.log('User created but pending confirmation. Check your email or project dashboard.')
        }
    }
}

main()
