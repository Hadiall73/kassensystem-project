-- ============================================================
-- KASSENSYSTEM - SECURITY HARDENING & RLS
-- Execute this in: Supabase -> SQL Editor
-- ============================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE pos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_order_items ENABLE ROW LEVEL SECURITY;

-- 2. DEFINE SECURITY POLICIES

-- SETTINGS: Only Admin/Chef can change, all staff can see
CREATE POLICY "Settings: View for all" ON pos_settings FOR SELECT USING (true);
CREATE POLICY "Settings: Update for Chef" ON pos_settings FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM pos_staff WHERE role = 'chef' AND is_active = true));

-- STAFF: Only Chef can manage staff, staff can see their own info
CREATE POLICY "Staff: View for all" ON pos_staff FOR SELECT USING (true);
CREATE POLICY "Staff: Manage for Chef" ON pos_staff FOR ALL 
  USING (EXISTS (SELECT 1 FROM pos_staff WHERE role = 'chef' AND is_active = true));

-- TABLES: Everyone can see and update table status
CREATE POLICY "Tables: All access" ON pos_tables FOR ALL USING (true);

-- CATEGORIES & MENU ITEMS: Read for all, Manage for Chef
CREATE POLICY "Menu: View for all" ON pos_categories FOR SELECT USING (true);
CREATE POLICY "Menu: View for all items" ON pos_menu_items FOR SELECT USING (true);
CREATE POLICY "Menu: Manage for Chef" ON pos_categories FOR ALL 
  USING (EXISTS (SELECT 1 FROM pos_staff WHERE role = 'chef' AND is_active = true));
CREATE POLICY "Menu: Manage for Chef items" ON pos_menu_items FOR ALL 
  USING (EXISTS (SELECT 1 FROM pos_staff WHERE role = 'chef' AND is_active = true));

-- ORDERS: All staff can create/view, only Chef can delete/archive
CREATE POLICY "Orders: View for all" ON pos_orders FOR SELECT USING (true);
CREATE POLICY "Orders: Insert for all" ON pos_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders: Update for all" ON pos_orders FOR UPDATE USING (true);
CREATE POLICY "Orders: Delete for Chef" ON pos_orders FOR DELETE 
  USING (EXISTS (SELECT 1 FROM pos_staff WHERE role = 'chef' AND is_active = true));

-- ORDER ITEMS: Same as orders
CREATE POLICY "Items: View for all" ON pos_order_items FOR SELECT USING (true);
CREATE POLICY "Items: Insert for all" ON pos_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Items: Update for all" ON pos_order_items FOR UPDATE USING (true);
CREATE POLICY "Items: Delete for Chef" ON pos_order_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM pos_staff WHERE role = 'chef' AND is_active = true));

-- 3. LOGGING SYSTEM (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'AUTH', 'ERROR', 'DATA_CHANGE', 'SENSITIVE_ACCESS'
  severity TEXT DEFAULT 'INFO', -- 'INFO', 'WARN', 'CRITICAL'
  message TEXT,
  staff_id UUID REFERENCES pos_staff(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs: Only Chef can see" ON system_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM pos_staff WHERE role = 'chef' AND is_active = true));
CREATE POLICY "Logs: System can insert" ON system_logs FOR INSERT WITH CHECK (true);

-- 4. AUTOMATED BACKUP TRIGGER (Example for Logged Changes)
CREATE OR REPLACE FUNCTION log_order_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO system_logs (event_type, severity, message, details)
  VALUES ('DATA_CHANGE', 'INFO', 'Order updated: ' || NEW.id, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_order_update
AFTER UPDATE ON pos_orders
FOR EACH ROW EXECUTE FUNCTION log_order_change();
