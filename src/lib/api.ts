import { NextResponse } from 'next/server';
import type { ZodType, ZodTypeDef } from 'zod';
import { DbNotReadyError } from './db';
import { PersonaDataError } from './personaData';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** JSON 본문을 zod 로 검증하고 핸들러를 실행한다. 오류는 { error } 로 통일. */
export async function handleJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>, run: (body: T) => unknown | Promise<unknown>) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // 직접 쓴 검증 문구(custom)만 그대로 보여주고, 나머지는 어느 항목인지만 알린다
    const issue = parsed.error.issues[0];
    const message = issue.code === 'custom' ? issue.message : `입력값이 올바르지 않습니다 (${issue.path.join('.') || '본문'}).`;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  try {
    return NextResponse.json(await run(parsed.data));
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof DbNotReadyError || error instanceof PersonaDataError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: '서버에서 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
