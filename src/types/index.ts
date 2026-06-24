// Type definitions for 'where-is-it' (어디뒀더라?)

export interface Space {
  id: string;
  user_id: string;
  group_id?: string;
  name: string;
  icon: string;
  created_at: string;
}

export interface StorageUnit {
  id: string;
  space_id: string;
  user_id: string;
  group_id?: string;
  name: string;
  icon: string;
  image_url?: string;
  created_at: string;
}

export interface Section {
  id: string;
  storage_id: string;
  user_id: string;
  group_id?: string;
  name: string;
  icon?: string;
  image_url?: string;
  created_at: string;
}

export interface Item {
  id: string;
  section_id: string;
  user_id: string;
  group_id?: string;
  name: string;
  description?: string;
  image_url?: string;
  quantity: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  expiration_date?: string | null;
}

// Search result item with breadcrumb path
export interface SearchItemResult extends Item {
  space_name: string;
  space_icon: string;
  storage_name: string;
  storage_icon: string;
  section_name: string;
}

export interface UserSession {
  id: string;
  email?: string;
  is_anonymous: boolean;
}

export interface Group {
  id: string;
  code: string;
  owner_id: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string; // 'owner' | 'member'
  created_at: string;
}
