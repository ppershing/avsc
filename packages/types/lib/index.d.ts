/** Supported primitive type names. */
type PrimTypeName =
  | 'null'
  | 'boolean'
  | 'int' | 'long' | 'float' | 'double'
  | 'string'
  | 'bytes';

/** Attributes present in all schemas. */
interface BaseSchema {
  doc?: string;
  logicalType?: string;
}

/** Attributes present in all named schemas. */
interface NamedSchema extends BaseSchema {
  name: string;
  aliases?: string[];
  namespace?: string;
}

/** Record field schema. */
interface FieldSchema<E = {}> {
  name: string;
  type: Schema<E>;
  aliases?: string[];
  doc?: string;
  order?: 'ascending' | 'descending' | 'ignore';
  default?: any;
}

/** Avro schema. */
type Schema<E = {}> =
  | {type: PrimTypeName} & BaseSchema & E
  | {type: 'array', items: Schema<E>} & BaseSchema & E
  | {type: 'enum', symbols: string[]} & NamedSchema & E
  | {type: 'fixed', size: number} & NamedSchema & E
  | {type: 'map', values: Schema<E>} & BaseSchema & E
  | {type: 'record', fields: FieldSchema<E>[]} & NamedSchema & E
  | Schema<E>[] // Union.
  | Type // Already "instantiated" schema.
  | string; // References.

/** Base Avro type. */
export class Type<V = any> {
  protected constructor(schema: Schema, opts: Type.ForSchemaOpts);

  readonly name: string | undefined;
  readonly aliases: string[] | undefined;
  readonly branchName: string | undefined;
  readonly doc: string | undefined;

  binaryDecode(buf: Buffer, resolver?: Type.Resolver<V>, noCheck?: boolean): V;

  binaryDecodeAt(
    buf: Buffer,
    pos: number,
    resolver?: Type.Resolver<V>
  ): {readonly value: V; readonly offset: number};

  binaryEncode(val: V): Buffer;

  binaryEncodeAt(val: V, buf: Buffer, pos: number): number;

  jsonDecode(
    data: any,
    resolver?: Type.Resolver<V>,
    allowUndeclaredFields?: boolean
  ): V;

  jsonEncode(val: V, opts?: Type.JsonEncodeOpts): any;

  createResolver(writer: Type): Type.Resolver<V>;

  checkValid(val: V, opts?: Type.CheckValidOpts): void;

  isValid(val: V, opts?: Type.IsValidOpts): boolean;

  clone(val: V): V;

  wrap(val: V): any;

  compare(val1: V, val2: V): -1 | 0 | 1;

  binaryCompare(buf1: Buffer, buf2: Buffer): -1 | 0 | 1;

  equals(other: Type): boolean;

  schema(opts?: Type.SchemaOpts): Schema;

  static isType(val: any, ...prefixes: string[]): boolean;

  static forSchema<V = Type>(
    schema: Schema,
    opts?: Type.ForSchemaOpts
  ): V extends Type ? V : Type<V>;

  static forTypes(types: [], opts?: Type.ForValueOpts): never;
  static forTypes<T extends Type>(types: [T], opts?: Type.ForValueOpts): T;
  static forTypes<T>(
    types: ReadonlyArray<Type>,
    opts?: Type.ForValueOpts
  ): T extends Type ? T : Type<T>;

  static forValue<V>(
    val: any,
    opts?: Type.ForValueOpts
  ): V extends Type ? V : Type<V>;

  static __reset(size: number): void;
}

export namespace Type {
  interface JsonEncodeOpts {
    readonly omitDefaultValues?: boolean;
  }

  interface CheckValidOpts {
    readonly allowUndeclaredFields?: boolean;
  }

  type ErrorHook = (path: ReadonlyArray<string>, val: any, type: Type) => void;

  interface IsValidOpts {
    readonly allowUndeclaredFields?: boolean;
    readonly errorHook?: ErrorHook;
  }

  interface SchemaOpts {
    readonly exportAttrs?: boolean;
    readonly noDeref?: boolean;
  }

  type TypeHook = (schema: Schema, opts: Type.ForSchemaOpts) => Type | undefined;

  interface ForSchemaOpts {
    readonly allowAnonymousTypes?: boolean;
    readonly assertLogicalTypes?: boolean;
    readonly errorStackTraces?: boolean;
    readonly logicalTypes?: {[name: string]: typeof LogicalType.constructor};
    readonly registry?: {[name: string]: Type};
    readonly typeHook?: TypeHook;
    readonly wrapUnions?: 'auto' | 'always' | 'never' | boolean;
  }

  type ValueHook = (val: any, opts: Type.ForValueOpts) => Type | undefined;

  interface ForValueOpts extends Type.ForSchemaOpts {
    readonly emptyArrayType?: ArrayType;
    readonly valueHook?: ValueHook;
  }

  type Resolver<V> = {__type: 'avroTypesResolver'}; // TODO: Find a better way.
}

type PrimType<V, N extends string> = Type<V> & {
  readonly name: undefined;
  readonly aliases: undefined;
  readonly branchName: N;
  readonly typeName: N;

  wrap(val: V): Record<N, V>;
}

export type NullType = PrimType<null, 'null'>;
export type BooleanType = PrimType<boolean, 'boolean'>;
export type IntType = PrimType<number, 'int'>;
export type FloatType = PrimType<number, 'float'>;
export type DoubleType = PrimType<number, 'double'>;
export type StringType = PrimType<string, 'string'>;
export type BytesType = PrimType<Buffer, 'bytes'>;

export class LongType<V = number, N extends 'long' | 'abstract:long' = 'long'> extends Type<V> {
  readonly name: undefined;
  readonly aliases: undefined;
  readonly branchName: 'long';
  readonly typeName: N;

  static __with<V = any>(): LongType<V, 'abstract:long'>;
}

export class FixedType extends Type<number> {
  readonly name: string;
  readonly aliases: string[];
  readonly branchName: string;
  readonly typeName: 'fixed';
  readonly size: number;
}

export class EnumType extends Type<string> {
  readonly name: string;
  readonly aliases: string[];
  readonly branchName: string;
  readonly typeName: 'enum';
  readonly symbols: ReadonlyArray<string>;
}

export class ArrayType<V = any> extends Type<V[]> {
  readonly name: undefined;
  readonly aliases: undefined;
  readonly branchName: 'array';
  readonly typeName: 'array';
  readonly itemsType: Type<V>;
}

export class MapType<V = any> extends Type<{[key: string]: V}> {
  readonly name: undefined;
  readonly aliases: undefined;
  readonly branchName: 'map';
  readonly typeName: 'map';
  readonly valuesType: Type<V>;
}

interface Field {
  readonly name: string;
  readonly aliases: string[];
  readonly type: Type;
  readonly order: 'ascending' | 'descending' | 'ignore';
  readonly defaultValue: any;
}

interface RecordConstructor<V> {
  new(...args: any[]): V;
  fromBuffer(buf: Buffer): V;
  fromJSON(data: any): V;
  fromObject(obj: any): V;
}

interface GeneratedRecord<V> {
  clone(): V;
  compare(other: V): -1 | 0 | 1;
  isValid(opts?: Type.IsValidOpts): boolean;
  binaryEncode(): Buffer;
  jsonEncode(opts?: Type.JsonEncodeOpts): any;
  wrap(): any;
}

export class RecordType<V = any> extends Type<V & GeneratedRecord<V>> {
  readonly name: string;
  readonly aliases: string[];
  readonly branchName: string;
  readonly typeName: 'record' | 'error';
  readonly recordConstructor: RecordConstructor<V & GeneratedRecord<V>>;
  readonly fields: ReadonlyArray<Field>;

  field(name: string): Field | undefined;
}

export class LogicalType<V = any> extends Type<V> {
  readonly branchName: string;
  readonly typeName: string;
  readonly underlyingType: Type;

  protected _toValue(data: any): V;
  protected _fromValue(val: V): any;
  protected _resolve<W = any>(otherType: Type<W>): (otherVal: W) => V;
  protected _export(schema: Schema): void;
}

export class UnionType<V = any> extends Type<V> {
  readonly name: undefined;
  readonly branchName: undefined;
  readonly types: ReadonlyArray<Type>;
}