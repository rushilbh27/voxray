# Day 1 Implementation Guide

## Goal
By end of today: Working dashboard showing real Uganda call data from Ultravox API.

---

## Checklist

### Setup (30 minutes)
- [ ] Create Next.js project: `ultravox-ops`
- [ ] Install dependencies: `@supabase/supabase-js`, `recharts`, `date-fns`
- [ ] Set up environment variables
- [ ] Verify Ultravox API access

### Database (30 minutes)
- [ ] Create Supabase project (if needed)
- [ ] Run SQL schema creation
- [ ] Test database connection
- [ ] Verify tables created

### API Integration (45 minutes)
- [ ] Create Ultravox API client (`lib/ultravox.ts`)
- [ ] Test fetching calls
- [ ] Test fetching call details
- [ ] Test fetching messages

### Sync Script (45 minutes)
- [ ] Create `scripts/sync-calls.ts`
- [ ] Implement basic sync logic
- [ ] Test syncing 10 calls
- [ ] Verify data in Supabase

### Dashboard (60 minutes)
- [ ] Create basic layout
- [ ] Display metrics cards
- [ ] Display call list
- [ ] Add basic styling
- [ ] Test in browser

### Polish (30 minutes)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test on mobile
- [ ] Take screenshots

---

## Step-by-Step Instructions

### 1. Create Project

```bash
# Create Next.js app
npx create-next-app@latest voxray \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

# Navigate to project
cd voxray

# Install dependencies
npm install @supabase/supabase-js recharts date-fns

# Install dev dependencies
npm install -D tsx @types/node
```

### 2. Set Up Environment Variables

Create `.env.local`:
```bash
# Ultravox API
ULTRAVOX_API_KEY=your_ultravox_api_key_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: For call analysis
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
```

**Get these values:**
- Ultravox API Key: https://app.ultravox.ai → Settings → API Keys
- Supabase credentials: https://app.supabase.com → Your Project → Settings → API

### 3. Create Database Schema

Go to Supabase SQL Editor and run:

```sql
-- Main calls table
CREATE TABLE ultravox_calls (
  call_id text PRIMARY KEY,
  agent_id text NOT NULL,
  status text NOT NULL,
  duration_seconds integer DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  ended_reason text,
  client_name text,
  created_at timestamptz NOT NULL,
  ended_at timestamptz,
  synced_at timestamptz DEFAULT now(),
  raw_data jsonb,
  CONSTRAINT valid_status CHECK (status IN ('active', 'ended', 'failed'))
);

-- Messages table
CREATE TABLE ultravox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL REFERENCES ultravox_calls(call_id) ON DELETE CASCADE,
  role text NOT NULL,
  text text NOT NULL,
  ordinal integer NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT valid_role CHECK (role IN ('user', 'agent'))
);

-- Tools table
CREATE TABLE ultravox_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL REFERENCES ultravox_calls(call_id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  parameters jsonb,
  result jsonb,
  invocation_time timestamptz NOT NULL,
  status text,
  error_message text
);

-- Add indexes for performance
CREATE INDEX idx_calls_created ON ultravox_calls(created_at DESC);
CREATE INDEX idx_calls_status ON ultravox_calls(status);
CREATE INDEX idx_calls_client ON ultravox_calls(client_name);
CREATE INDEX idx_calls_agent ON ultravox_calls(agent_id);
CREATE INDEX idx_messages_call ON ultravox_messages(call_id, ordinal);
CREATE INDEX idx_messages_role ON ultravox_messages(role);
CREATE INDEX idx_tools_call ON ultravox_tools(call_id);
CREATE INDEX idx_tools_name ON ultravox_tools(tool_name);
```

### 4. Create Ultravox API Client

Create `lib/ultravox.ts`:

```typescript
const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api';

export interface UltravoxCall {
  id: string;
  agentId: string;
  ended: boolean;
  endedReason?: string;
  durationSeconds?: number;
  created: string;
  // ... other fields from API
}

export interface UltravoxMessage {
  role: string;
  text: string;
  ordinal: number;
  created: string;
}

export async function fetchCalls(limit = 100): Promise<UltravoxCall[]> {
  const response = await fetch(
    `${ULTRAVOX_API_URL}/calls?limit=${limit}&ordering=-created`,
    {
      headers: {
        'X-API-Key': process.env.ULTRAVOX_API_KEY!,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Ultravox API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

export async function fetchCallDetails(callId: string): Promise<UltravoxCall> {
  const response = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}`, {
    headers: {
      'X-API-Key': process.env.ULTRAVOX_API_KEY!,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch call ${callId}: ${response.status}`);
  }

  return response.json();
}

export async function fetchCallMessages(
  callId: string
): Promise<UltravoxMessage[]> {
  const response = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}/messages`, {
    headers: {
      'X-API-Key': process.env.ULTRAVOX_API_KEY!,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch messages for ${callId}: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

export async function fetchCallTools(callId: string) {
  const response = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}/tools`, {
    headers: {
      'X-API-Key': process.env.ULTRAVOX_API_KEY!,
    },
  });

  if (!response.ok) {
    return []; // Tools are optional
  }

  const data = await response.json();
  return data.results;
}
```

### 5. Create Supabase Client

Create `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

// Client for browser (read-only)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client for server (read-write)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### 6. Create Sync Script

Create `scripts/sync-calls.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { fetchCalls, fetchCallMessages, fetchCallTools } from '../lib/ultravox';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getClientName(agentId: string): string {
  if (agentId.toLowerCase().includes('ramco')) return 'Ramco Gas';
  if (agentId.toLowerCase().includes('edifice')) return 'Edifice Properties';
  if (agentId.toLowerCase().includes('davansh')) return 'Davansh Investment';
  return 'Unknown';
}

async function syncCalls() {
  console.log('🔄 Starting Ultravox call sync...');

  try {
    // 1. Fetch calls from Ultravox
    const calls = await fetchCalls(100);
    console.log(`📞 Found ${calls.length} calls from Ultravox`);

    // 2. Sync each call
    for (const call of calls) {
      const clientName = getClientName(call.agentId);

      // Insert/update call
      const { error: callError } = await supabase.from('ultravox_calls').upsert(
        {
          call_id: call.id,
          agent_id: call.agentId,
          status: call.ended ? 'ended' : 'active',
          duration_seconds: call.durationSeconds || 0,
          cost_usd: ((call.durationSeconds || 0) / 60) * 0.05, // $0.05/min
          ended_reason: call.endedReason,
          client_name: clientName,
          created_at: call.created,
          ended_at: call.ended ? new Date().toISOString() : null,
          raw_data: call,
        },
        { onConflict: 'call_id' }
      );

      if (callError) {
        console.error(`❌ Error syncing call ${call.id}:`, callError);
        continue;
      }

      console.log(`✅ Synced call ${call.id} (${clientName})`);

      // 3. If call is ended, fetch messages and tools
      if (call.ended) {
        try {
          // Fetch and store messages
          const messages = await fetchCallMessages(call.id);
          for (const message of messages) {
            await supabase.from('ultravox_messages').upsert(
              {
                call_id: call.id,
                role: message.role,
                text: message.text,
                ordinal: message.ordinal,
                created_at: message.created,
              },
              { onConflict: 'call_id,ordinal' }
            );
          }
          console.log(`  📝 Synced ${messages.length} messages`);

          // Fetch and store tools
          const tools = await fetchCallTools(call.id);
          for (const tool of tools) {
            await supabase.from('ultravox_tools').upsert({
              call_id: call.id,
              tool_name: tool.name,
              parameters: tool.parameters,
              result: tool.result,
              invocation_time: tool.invocationTime,
              status: tool.result ? 'success' : 'error',
              error_message: tool.errorMessage,
            });
          }
          console.log(`  🔧 Synced ${tools.length} tool calls`);
        } catch (error) {
          console.error(`  ⚠️  Error fetching details for ${call.id}:`, error);
        }
      }
    }

    console.log('✨ Sync complete!');
  } catch (error) {
    console.error('💥 Sync failed:', error);
    process.exit(1);
  }
}

// Run sync
syncCalls();
```

Add to `package.json`:
```json
{
  "scripts": {
    "sync": "tsx scripts/sync-calls.ts"
  }
}
```

### 7. Test the Sync

```bash
npm run sync
```

**Expected output:**
```
🔄 Starting Ultravox call sync...
📞 Found 87 calls from Ultravox
✅ Synced call abc123 (Ramco Gas)
  📝 Synced 12 messages
  🔧 Synced 2 tool calls
✅ Synced call def456 (Edifice Properties)
  📝 Synced 8 messages
  🔧 Synced 0 tool calls
...
✨ Sync complete!
```

### 8. Create Dashboard

Replace `app/page.tsx`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const revalidate = 60; // Revalidate every 60 seconds

export default async function Dashboard() {
  // Fetch calls
  const { data: calls } = await supabase
    .from('ultravox_calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  // Calculate metrics
  const totalCalls = calls?.length || 0;
  const successfulCalls =
    calls?.filter(
      (c) => c.status === 'ended' && !c.ended_reason?.includes('error')
    ).length || 0;
  const successRate =
    totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
  const totalCost =
    calls?.reduce((sum, call) => sum + (call.cost_usd || 0), 0) || 0;
  const avgDuration =
    calls && calls.length > 0
      ? Math.round(
          calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) /
            calls.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Voxray
          </h1>
          <p className="text-gray-600 mt-2">
            X-ray vision for your voice agents
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Total Calls</div>
            <div className="text-3xl font-bold text-gray-900">{totalCalls}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Success Rate</div>
            <div className="text-3xl font-bold text-green-600">
              {successRate}%
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Total Cost</div>
            <div className="text-3xl font-bold text-gray-900">
              ${totalCost.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Avg Duration</div>
            <div className="text-3xl font-bold text-gray-900">
              {Math.floor(avgDuration / 60)}m {avgDuration % 60}s
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Active Now</div>
            <div className="text-3xl font-bold text-blue-600">
              {calls?.filter((c) => c.status === 'active').length || 0}
            </div>
          </div>
        </div>

        {/* Call List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {calls?.map((call) => (
              <div
                key={call.call_id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          call.status === 'ended' && !call.ended_reason?.includes('error')
                            ? 'bg-green-100 text-green-800'
                            : call.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {call.status}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {call.client_name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {call.call_id}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div className="font-medium">
                      {Math.floor(call.duration_seconds / 60)}m{' '}
                      {call.duration_seconds % 60}s
                    </div>
                    <div className="text-xs">
                      ${call.cost_usd?.toFixed(3) || '0.000'}
                    </div>
                    <div className="text-xs mt-1">
                      {new Date(call.created_at).toLocaleDateString()}{' '}
                      {new Date(call.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                {call.ended_reason && (
                  <div className="mt-2 text-xs text-red-600">
                    Ended: {call.ended_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 9. Run the App

```bash
npm run dev
```

Visit: http://localhost:3000

**You should see:**
- ✅ Metrics cards with real data
- ✅ List of calls from Uganda
- ✅ Color-coded status badges
- ✅ Duration and cost per call

---

## Troubleshooting

### "Ultravox API error: 401"
- Check your API key in `.env.local`
- Make sure it's the correct format: `Zk9Ht7Lm.wX7pN9fM3kLj6tRq2bGhA8yE5cZvD4sT`

### "Supabase error: permission denied"
- Use `SUPABASE_SERVICE_ROLE_KEY` for sync script
- Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-side

### "No calls showing"
- Run `npm run sync` first
- Check Supabase table has data: `SELECT * FROM ultravox_calls LIMIT 10`
- Check console for errors

### "Dashboard won't load"
- Check `.env.local` variables are set
- Restart dev server after changing env vars
- Check browser console for errors

---

## End of Day 1 Deliverables

✅ **Working sync script** that pulls Uganda calls  
✅ **Supabase database** with call data  
✅ **Dashboard** showing real metrics  
✅ **Screenshot** for Twitter post  

## Tomorrow (Day 2)

- Add call detail pages
- Display full transcripts
- Show tool calls
- Add filters (client, status, date)
