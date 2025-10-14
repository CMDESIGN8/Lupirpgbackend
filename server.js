import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || "https://xvdevkrgsgiiqqhfnnut.supabase.co",
  process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGV2a3Jnc2dpaXFxaGZubnV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MzMwMDQsImV4cCI6MjA3MTMwOTAwNH0.uS3WC9rdNeAeGmiJdwKC-q1N_w_rDE413Zu62rfmLVc"
);

// === PLAYER ENDPOINTS ===
app.get('/api/player/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/player/:userId/avatars', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('player_id', userId);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/player/:userId/club', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('club_members')
      .select(`
        clubs (*)
      `)
      .eq('player_id', userId)
      .single();

    if (error) throw error;
    res.json(data?.clubs || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === INVENTORY ENDPOINTS ===
app.get('/api/inventory/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('player_inventory')
      .select(`
        *,
        items (*)
      `)
      .eq('player_id', userId);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory/add', async (req, res) => {
  try {
    const { player_id, item_id } = req.body;
    
    const { data, error } = await supabase
      .from('player_inventory')
      .insert([{ player_id, item_id }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/equip', async (req, res) => {
  try {
    const { player_item_id, equip } = req.body;
    
    const { data, error } = await supabase
      .from('player_inventory')
      .update({ equipped: equip })
      .eq('id', player_item_id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === MISSIONS ENDPOINTS ===
app.get('/api/player/:userId/missions', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('player_missions')
      .select(`
        *,
        missions (*)
      `)
      .eq('player_id', userId);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/missions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .select('*');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === ITEMS ENDPOINTS ===
app.get('/api/items', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'LupiRPG Backend running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});