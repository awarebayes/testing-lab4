import { Elysia, t } from "elysia";
import { html } from "@elysiajs/html";
import { kv } from "@vercel/kv";
import { timingSafeEqual } from "crypto";

let two_factor_tokens: Record<string, string> = {};

let get_2fa_token = () => {
  return Math.floor(Math.random() * 900_000 + 100_000).toString();
};

let send_2fa_email = async (email: string, token: string) => {
  const apiKey = Bun.env.MAILGUN_API_KEY!;
  const apiUrl = `https://api.mailgun.net/v3/${Bun.env.MAILGUN_API_DOMAIN}/messages`;
  const formData = new FormData();
  formData.append(
    "from",
    `Lab4 2FA team <mailgun@${Bun.env.MAILGUN_API_DOMAIN}>`,
  );
  formData.append("to", email);
  formData.append("subject", "Two Factor Authentication");
  formData.append("text", `Token: ${token}`);

  return await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa("api:" + apiKey),
    },
    body: formData,
  }).then((x) => x.json());
};

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  const maxLength = Math.max(bufferA.length, bufferB.length);

  // Pad the shorter buffer with zeros
  const paddedBufferA = Buffer.concat([
    Buffer.alloc(maxLength - bufferA.length, 0),
    bufferA,
  ]);

  const paddedBufferB = Buffer.concat([
    Buffer.alloc(maxLength - bufferB.length, 0),
    bufferB,
  ]);

  // Use timingSafeEqual to perform constant time comparison
  return timingSafeEqual(paddedBufferA, paddedBufferB);
}

const app = new Elysia()
  .use(html())
  .get("/", () => (
    <html lang="en">
      <head>
        <title>Login Page</title>
      </head>
      <body>
        <h1>Login page</h1>
        <form action="/login" method="post">
          <div>
            <label for="email">Enter your email: </label>
            <input type="email" name="email" id="email" required />
          </div>
          <div>
            <label for="password">Enter your passw: </label>
            <input type="password" name="password" id="password" required />
          </div>
          <input type="submit" value="Sign In" />
        </form>
      </body>
    </html>
  ))
  .post(
    "/login",
    async ({ body, set }) => {
      const password = (await kv.hgetall(`user:${body.email}`)) as {
        password: string;
      } | null;
      if (!password) {
        set.redirect = "/login-failed?reason=no-user";
        return;
      }
      if (!timingSafeStringEqual(password.password, body.password)) {
        set.redirect = "/login-failed?reason=wrong-password";
        return;
      }

      // Password match, generate two factor
      let token = get_2fa_token();
      two_factor_tokens[body.email] = token;

      await send_2fa_email(body.email, token);

      set.redirect = `/two-factor?email=${body.email}`;
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
    },
  )
  .get("/login-failed", ({ query }) => (
    <html lang="en">
      <head>
        <title>Login Failed</title>
      </head>
      <body>
        <h1>Login failed :(</h1>
        <h2> Reason: {query.reason || "None"} </h2>
      </body>
    </html>
  ))
  .get(
    "/two-factor",
    ({ query }) => {
      return (
        <html lang="en">
          <head>
            <title>2FA Page</title>
          </head>
          <body>
            <div>A verification email has been sent to {query.email}</div>
            <form action={`/two-factor?email=${query.email}`} method="post">
              <div>
                <label for="two_factor">Enter your code: </label>
                <input type="text" name="two_factor" id="two_factor" required />
              </div>
              <input type="submit" value="Confirm" />
            </form>
          </body>
        </html>
      );
    },
    {
      query: t.Object({
        email: t.String(),
      }),
    },
  )
  .post(
    "/two-factor",
    ({ query, body, set }) => {
      if (!Object.keys(two_factor_tokens).includes(query.email)) {
        set.redirect = "/login-failed?reason=2fa-was-not-requested";
        return;
      }
      let original_token = two_factor_tokens[query.email];
      let entered_token = body.two_factor;
      if (!timingSafeStringEqual(original_token, entered_token)) {
        set.redirect = "/login-failed?reason=2fa-token-mismatch";
        return;
      }
      set.redirect = "/login-success";
    },
    {
      query: t.Object({
        email: t.String(),
      }),
      body: t.Object({
        two_factor: t.String(),
      }),
    },
  )
  .get("/login-success", () => (
    <html lang="en">
      <head>
        <title>Login Success</title>
      </head>
      <body>Login Success! Yay!!!</body>
    </html>
  ))
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
