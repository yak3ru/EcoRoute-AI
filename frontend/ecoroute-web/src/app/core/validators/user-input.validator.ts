
// FULL NAME
export function validateFullName(value: string): string | null {
  if (value.length < 2) return 'Full name is too short.';
  if (value.length > 150) return "Full name can't be longer than 150 characters.";
  if (/\d/.test(value)) return "Full name can't contain numbers.";
  if (/[^\p{L} .'-]/u.test(value)) return "Full name can't contain special characters (only . ' - are allowed).";
  if (!/^\p{L}/u.test(value)) return 'Full name must start with a letter.';
  if (!value.includes(' ')) return 'Please enter both your first and last name.';
  return null;
}

// EMAIL
export function validateEmail(value: string): string | null {
  if (value.length > 150) return "Email can't be longer than 150 characters.";
  if (/\s/.test(value)) return "Email can't contain spaces.";
  if (!value.includes('@')) return 'Email must contain an @ symbol.';
  if (value.split('@').length > 2) return 'Email can only contain one @ symbol.';

  const [local, domain] = value.split('@');
  if (!local) return 'Please enter the part before the @ (e.g. juan@gmail.com).';
  if (!domain) return 'Please enter the domain after the @ (e.g. gmail.com).';
  if (!/^(?!-)[a-zA-Z0-9-]+(?<!-)(\.(?!-)[a-zA-Z0-9-]+(?<!-))*\.[a-zA-Z]{2,}$/.test(domain))
    return 'Email domain is invalid (e.g. gmail.com).';
  return null;
}

// USERNAME
export function validateUsername(value: string): string | null {
  if (value.length < 3) return 'Username must be at least 3 characters.';
  if (value.length > 30) return "Username can't be longer than 30 characters.";
  if (/\s/.test(value)) return "Username can't contain spaces.";
  if (value.includes('@')) return "Username can't contain @.";
  if (/[^a-zA-Z0-9._-]/.test(value)) return "Username can't contain special characters (only . _ - are allowed).";
  return null;
}

// PASSWORD
export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters long.';
  if (value.length > 64) return "Password can't be longer than 64 characters.";
  if (/\s/.test(value)) return "Password can't contain spaces.";
  if (!/[A-Z]/.test(value)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must include at least one number.';
  if (!/[^a-zA-Z0-9]/.test(value)) return 'Password must include at least one special character.';
  return null;
}
