using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record QualityEvent(string QueueId, string Kind, string Message);
