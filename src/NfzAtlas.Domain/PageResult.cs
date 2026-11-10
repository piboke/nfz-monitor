using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record PageResult(
    int Count,
    int Page,
    int Limit,
    bool HasNext,
    JsonElement[] Records
);
