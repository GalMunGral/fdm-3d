type int = number;
type float = number;
type Fn = (i: int, j: int) => float;
type HelperKeys = "u" | "v" | "dudx" | "dudy" | "d2udx2" | "d2udy2";
type Helper = Record<HelperKeys, Fn>;
type UserFn = (i: int, j: int, helper: Helper) => float;
