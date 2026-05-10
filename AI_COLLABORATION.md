# 🤖 AI Collaboration Guide: Kassensystem
This document serves as the bridge between the cloud architect (DEER) and the local AI assistant (Ollama/Llama3.2).

## 🎯 Project Goal
Establish a secure, stable, and offline-first POS system.

## 🛠️ Technical Architecture
### 1. Database & Security (Supabase)
- **RLS (Row Level Security):** ENABLED on all tables.
- **Auth:** Roles are `chef`, `kellner`, `kueche`.

### 2. Offline-First Strategy
- **Logic:** Orders are queued in `localStorage` under the key `openclaw_order_queue`.
- **Sync:** The `OfflineSync` utility in `lib/supabase.ts` handles the upload once connectivity is restored.

## 📂 Project Structure
- **Path:** `C:\Users\bib\kassensystem`

## 📝 Instructions for Local AI
1. **Consistency:** Use `OfflineSync.enqueueOrder()` for any new order-related features.
2. **Safety:** Never suggest disabling RLS.
3. **Consultation:** For database schema changes, consult **DEER**.

## 🔄 Sync Cycle
Cloud AI (DEER) $\rightarrow$ Updates this guide $\rightarrow$ Local AI (Llama3.2) reads guide $\rightarrow$ Executes micro-tasks.
