-- 1. Create Users Table (Private Custom Table)
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    uid TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Store hashed passwords only (bcrypt/argon2). Never store plaintext.
    name TEXT,
    academic_id TEXT,
    gpa TEXT,
    level TEXT,
    department TEXT,
    age TEXT,
    gender TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Create Doctors Table (Whitelist)
CREATE TABLE IF NOT EXISTS public.doctors (
    email TEXT PRIMARY KEY
);

-- 3. Insert Users Data (passwords removed for security)
-- IMPORTANT: Passwords must be hashed before insertion. Use bcrypt/argon2 in your backend.
-- Example: INSERT INTO public.users (email, password_hash, name, uid, academic_id, gpa, level, department, age, gender, phone)
-- VALUES ('user@example.com', crypt('password', gen_salt('bf')), 'Name', 'uid', ...);
INSERT INTO public.users (email, name, uid, academic_id, gpa, level, department, age, gender, phone)
VALUES 
('2420766@batechu.com', 'عبد الله محمد علي حسن', 'oAsPWkxD7ycsRQr7NyQ6ZbtxNKe2', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('2420677@batechu.com', 'عبد الله احمد عبدالمنعم محمد', 'JGbHHplU57U0X8CqFu7lFlOX8Wy2', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('abdoali@batechu.com', 'عبدرحمن علي', 'NmheUP6NBTe0wLiN7BbBnOSBRxp1', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('2420000@batechu.com', 'عبدالله محمد عادل', 'dWw5wnJeOLgrNmCKG2OhpLtclo72', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('user4@batechu.com', 'عمار محمد', 'JEWdIn9h0XgCwTeJHBLWiKSOKnG2', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('2420803@batechu.com', 'علي محمد', 'MFq0uKhUSeOGVBtkLZDlfpmBuGx2', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('user6@batechu.com', 'علي احمد', 'onL0E6QeOYWv5S8KCdu4oxtHD843', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('user7@batechu.com', 'محمد سعد', '0eYjvanKTNgR1VOOCShxRfjg0xn1', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('a@123.com', 'Hello,test', 'a@123.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('doc@abdo.com', 'doctor abdo', 'doc@abdo.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('assama@nhas.com', 'doctor assama', 'assama@nhas.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('mohamed@test.com', 'St:Mohamed Abdallah', 'mohamed@test.com', '12345678910111', '3.2', '3', 'Computer Science', '21', 'Male', '123-456-7890'),
('TEST@TEST.com', 'TEST', 'TEST@TEST.com', '98765432109876', '2.8', '2', 'Information Systems', '20', 'Female', '098-765-4321'),
('12420762@batusc.com', 'St:Abdallah Mohamed Adel', '12420762@batusc.com', '12420762', '3.5', '4', 'Data Science', '22', 'Male', '555-555-5555'),
('std@2420111.com', '...', 'std@2420111.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (email) DO NOTHING;

-- 4. Insert Doctors Data
INSERT INTO public.doctors (email)
VALUES 
('2420766@batechu.com'),
('2420000@batechu.com'),
('doctor@example.com'),
('doc@abdo.com'),
('assama@nhas.com'),
('abdoali@batechu.com')
ON CONFLICT (email) DO NOTHING;

-- 5. Enable RLS (Optional but recommended, though we need public read for login in this insecure model)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Required for client-side query without auth)
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public read doctors" ON public.doctors FOR SELECT USING (true);
