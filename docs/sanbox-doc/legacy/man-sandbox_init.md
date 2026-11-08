SANDBOX\_INIT(3) - Library Functions Manual

# NAME

**sandbox\_init**,
**sandbox\_free\_error** - set process sandbox (DEPRECATED)

# SYNOPSIS

**#include &lt;sandbox.h&gt;**

*int*  
**sandbox\_init**(*const char \*profile*,
*uint64\_t flags*,
*char \*\*errorbuf*);

*void*  
**sandbox\_free\_error**(*char \*errorbuf*);

# DESCRIPTION

The
**sandbox\_init**()
and
**sandbox\_free\_error**()
functions are
**DEPRECATED**.
Developers who wish to sandbox an app should instead adopt the App Sandbox feature described in the App Sandbox Design Guide.

The
**sandbox\_init**()
function places the current process into a
sandbox(7). The NUL-terminated string
*profile*
specifies the profile to be used to configure the sandbox.
The
*flags*
specified are formed by
*or*'ing
the following values:

`SANDBOX_NAMED`

> The
> *profile*
> argument specifies a sandbox profile named by one of the constants
> given in the
> *AVAILABLE PROFILES*
> section below.

The out parameter
*\*errorbuf*
will be set according to the error status.

# RETURN VALUES

Upon successful completion of
**sandbox\_init**(),
a value of 0 is returned and
*\*errorbuf*
is set to NULL.  In the event of an error, a value of -1
is returned and
*\*errorbuf*
is set to a pointer to a NUL-terminated string describing the error.
This string may contain embedded newlines.  This error information is
suitable for developers and is not intended for end users.  This
pointer should be passed to
sandbox\_free\_error(3)
to release the allocated storage when it is no longer needed.

# AVAILABLE PROFILES

The following are brief descriptions of each available profile.
Keep in mind that
sandbox(7)
restrictions are typically enforced at resource acquisition time.

`kSBXProfileNoInternet`

> TCP/IP networking is prohibited.
> **DEPRECATED**.

`kSBXProfileNoNetwork`

> All sockets-based networking is prohibited.
> **DEPRECATED**.

`kSBXProfileNoWrite`

> File system writes are prohibited.
> **DEPRECATED**.

`kSBXProfileNoWriteExceptTemporary`

> File system writes are restricted to the temporary folder /var/tmp
> and the folder specified by the
> confstr(3)
> configuration variable \_CS\_DARWIN\_USER\_TEMP\_DIR.
> **DEPRECATED**.

`kSBXProfilePureComputation`

> All operating system services are prohibited.
> **DEPRECATED**.

**These profiles must not be used when building against macOS SDK &gt;= 27.0.**
**Processes opting into them will be killed on attempt to do so.**

# SEE ALSO

sandbox-exec(1),
sandbox(7),
sandboxd(8)

Mac OS X - March 9, 2017 - SANDBOX\_INIT(3)
