type Int = number;
type Float = number;
type Grid = Array<Array<Array<Float>>>;
type Fn = (i: Int, j: Int, k: Int) => Float;
type HelperKeys =
  | "u"
  | "v"
  | "dudx"
  | "dudy"
  | "dudz"
  | "d2udx2"
  | "d2udy2"
  | "d2udz2";
type Helper = Record<HelperKeys, Fn>;
type UserFn = (i: Int, j: Int, k: Int, helper: Helper) => Float;
