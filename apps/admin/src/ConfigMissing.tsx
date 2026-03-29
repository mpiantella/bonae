type Props = { missing: string[] };

export default function ConfigMissing({ missing }: Props) {
  return (
    <div className="app">
      <div className="card" style={{ maxWidth: '36rem' }}>
        <h1 style={{ marginTop: 0 }}>BONAE — Admin</h1>
        <p className="error" style={{ fontWeight: 600 }}>
          Configuration required
        </p>
        <p>
          Set the following environment variables before building or running the admin app (see{' '}
          <code>apps/admin/.env.example</code>):
        </p>
        <ul>
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: '0.9rem', color: '#475569' }}>
          For local development, copy <code>.env.example</code> to <code>.env.local</code> in{' '}
          <code>apps/admin</code> and fill values from your CDK stack outputs (
          <code>UserPoolId</code>, <code>UserPoolClientId</code>, <code>ApiUrl</code>).
        </p>
      </div>
    </div>
  );
}
