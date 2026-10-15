
// FULL NAME
export function validateFullName(value: string): string | null {
  const name = value.trim();

  if (!name) return 'Full name is required.';

  if (name.length > 50)
    return "Full name can't be longer than 50 characters.";

  if (name.length < 2)
    return 'Full name must contain at least 2 characters.';

  if (/\s{2,}/u.test(name))
    return 'Full name cannot contain repeated spaces.';

  if (!/^\p{Lu}/u.test(name))
    return 'Full name must start with a capital letter.';

  if (/\d/u.test(name))
    return "Full name can't contain numbers.";

  if (/[^\p{L} .'-]/u.test(name))
    return "Full name can only contain letters, spaces, periods, apostrophes, and hyphens.";

  const parts = name.split(' ');

  for (const part of parts) {
    const words = part.split(/[.-]|(?<=')/u).filter(Boolean);

    for (const word of words) {
      if (!/^\p{Lu}\p{Ll}*$/u.test(word)) {
        return 'Each name part must start with a capital letter followed by lowercase letters.';
      }
    }
  }

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
  const username = value.trim();

  if (!username)
    return 'Username is required.';

  if (username.length < 3)
    return 'Username must be at least 3 characters.';

  if (username.length > 30)
    return "Username can't be longer than 30 characters.";

  if (/\s/u.test(username))
    return "Username can't contain spaces.";

  if (!/^[a-zA-Z0-9._-]+$/.test(username))
    return "Username can only contain letters, numbers, periods, underscores, and hyphens.";

  if (!/[a-zA-Z0-9]/.test(username))
    return 'Username must contain at least one letter or number.';

  if (/^[._-]|[._-]$/.test(username))
    return 'Username cannot start or end with a period, underscore, or hyphen.';

  if (/[._-]{2,}/.test(username))
    return 'Username cannot contain consecutive special characters.';

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
